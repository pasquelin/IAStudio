import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatUnits } from '@/usage/format'
import {
  INTERACTIVE_REQUESTS_PER_MINUTE,
  type CostEstimate,
  type JobKind,
} from '@shared/domain/job'
import type { FieldDescriptor } from '@shared/domain/model'
import type { FormValues } from '@/helpers/dynamic-form'
import { getBridge } from '@/services/bridge'

/**
 * How long the form must sit still before its price is asked for.
 *
 * A dry run creates nothing and spends no credit, but it is an API request like any other and
 * the studio's own rate limit counts it. Long enough that typing a prompt asks once at the end
 * rather than once per letter; short enough that letting go of a slider answers straight away.
 */
export const ESTIMATE_DEBOUNCE_MS = 600

/**
 * The least time between two estimates actually sent.
 *
 * A trailing debounce alone has no ceiling, only a cliff: type slower than its delay and every
 * single keystroke lands in a window of its own and becomes a request. The floor turns the cliff
 * back into a bound, and the bound is the interactive share itself — estimates are not the only
 * thing spending from it, but they are the only thing that would spend from it continuously.
 */
export const ESTIMATE_MIN_INTERVAL_MS = 60_000 / INTERACTIVE_REQUESTS_PER_MINUTE

/**
 * When an estimate last actually left, for the whole window rather than per form.
 *
 * The floor below is what turns the debounce into a bound, and the bound is the interactive
 * share itself — which the main process sizes its poll loop against, once. Kept in a ref, the
 * generator and an App on screen together would each spend the whole share, and the poll loop
 * is the one that pays: a live, paid generation reported as a rate-limit failure.
 */
let lastSentAt = 0

/** Forgets when the last estimate left. For tests, which share this module between cases. */
export function resetCostBudget(): void {
  lastSentAt = 0
}

export type CostWatch = {
  /**
   * What to draw beside the submit button, or `undefined` when there is nothing to say. Absent
   * rather than zero: a button that says nothing is honest, one that says « 0 CU » would be
   * wrong about a run that costs.
   */
  note: string | undefined
  /** Hand it the body on every edit; it decides whether and when to actually ask. */
  onValuesChange: (body: FormValues) => void
}

/** Stable, so a form whose descriptor has not arrived does not rebuild the callback each render. */
const NO_FIELDS: readonly FieldDescriptor[] = []

/** A body missing something the model requires answers 400, never a price. */
function priceable(fields: readonly FieldDescriptor[], body: FormValues): boolean {
  return fields.every(field => !field.required || body[field.key] !== undefined)
}

/**
 * What the form in front of the user would cost, kept in step with it.
 *
 * Nothing to draw covers three cases the button treats alike — nothing asked yet, the API priced
 * nothing, the request failed. A price is a courtesy: none is a reason to say anything is wrong.
 *
 * A model and a workflow are priced by their own endpoints, and the kind is what picks between
 * them: two hooks would be two copies of the pacing below, which is the part that matters.
 */
export function useCostEstimate(
  kind: JobKind,
  targetId: string | null,
  fields: readonly FieldDescriptor[] = NO_FIELDS,
): CostWatch {
  const { t, i18n } = useTranslation()
  const [estimate, setEstimate] = useState<CostEstimate>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const priced = useRef<string | null>(null)
  // A ticket rather than an `AbortController`: an `invoke` cannot be cancelled, so an estimate
  // already sent is already paid for, and the only question left is whether its answer is still
  // the one being waited for. They do come back out of order.
  const asked = useRef(0)

  const request = useCallback(
    (body: FormValues): void => {
      const bridge = getBridge()
      if (!bridge || !targetId) return

      lastSentAt = Date.now()
      const ticket = ++asked.current
      void bridge.scenario
        .estimateCost({ kind, id: targetId }, body)
        // Cleared rather than kept: a figure that could not be refreshed is a figure about a
        // form the user has since changed. The body is forgotten with it, or a call that failed
        // once would leave that exact form unpriceable until something else about it changed.
        .catch(() => {
          priced.current = null
          return null
        })
        .then(answer => {
          // Same figure, same object identity: an unchanged price must not re-render the form.
          if (ticket === asked.current) {
            setEstimate(prev => (prev?.creativeUnits === answer?.creativeUnits ? prev : answer))
          }
        })
    },
    [kind, targetId],
  )

  /**
   * Another model is another price list, so the figure of the one before must not stay on the
   * button. Adjusted during the render rather than in an effect: React re-renders before it
   * commits, so the stale figure is never drawn once.
   *
   * What the cleanup below drops with it: the ticket, or an answer already in flight lands on
   * the new target's button and stays there; the timer, or a pause interrupted by a switch
   * spends an interactive request pricing a form nobody is looking at; the deduplication key,
   * or the same body under the new target reads as already priced.
   */
  const [pricedTarget, setPricedTarget] = useState(targetId)
  if (pricedTarget !== targetId) {
    setPricedTarget(targetId)
    setEstimate(null)
  }

  // The three memories, dropped as the target leaves. In a cleanup rather than in the render
  // above, which may not touch a ref — and each one alone was a defect.
  useEffect(
    () => () => {
      asked.current += 1
      priced.current = null
      if (timer.current !== null) {
        clearTimeout(timer.current)
        timer.current = null
      }
    },
    [kind, targetId],
  )

  const onValuesChange = useCallback(
    (body: FormValues): void => {
      if (!priceable(fields, body)) return

      // Typing a word back to what it already was must not buy the same answer twice. Keyed by
      // what is being priced as well: two models price the very same body differently.
      const shape = `${kind}:${targetId ?? ''}:${JSON.stringify(body)}`
      if (shape === priced.current) return

      if (timer.current !== null) clearTimeout(timer.current)
      const since = Date.now() - lastSentAt
      const wait = Math.max(ESTIMATE_DEBOUNCE_MS, ESTIMATE_MIN_INTERVAL_MS - since)

      timer.current = setTimeout(() => {
        priced.current = shape
        request(body)
      }, wait)
    },
    [fields, kind, targetId, request],
  )

  // Formatted here rather than by each form: the API prices a cheap call in fractions, and
  // `String(1/3)` is sixteen digits.
  const note = estimate
    ? t('generation.estimatedCost', { units: formatUnits(estimate.creativeUnits, i18n.language) })
    : undefined

  return { note, onValuesChange }
}
