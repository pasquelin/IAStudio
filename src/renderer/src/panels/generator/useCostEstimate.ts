import { useCallback, useEffect, useRef, useState } from 'react'
import { INTERACTIVE_REQUESTS_PER_MINUTE, type CostEstimate } from '@shared/domain/job'
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

export type CostWatch = {
  /** `null` while nothing has been priced, and when nothing can be. */
  estimate: CostEstimate
  /** Hand it the body on every edit; it decides whether and when to actually ask. */
  onValuesChange: (body: FormValues) => void
}

/** A body missing something the model requires answers 400, never a price. */
function priceable(fields: readonly FieldDescriptor[], body: FormValues): boolean {
  return fields.every(field => !field.required || body[field.key] !== undefined)
}

/**
 * What the form in front of the user would cost, kept in step with it.
 *
 * `null` covers three cases the button treats alike — nothing asked yet, the API priced nothing,
 * the request failed. A price is a courtesy: none of them is a reason to say anything is wrong.
 */
export function useCostEstimate(
  modelId: string | null,
  fields: readonly FieldDescriptor[] = [],
): CostWatch {
  const [estimate, setEstimate] = useState<CostEstimate>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentAt = useRef(0)
  const priced = useRef<string | null>(null)
  // A ticket rather than an `AbortController`: an `invoke` cannot be cancelled, so an estimate
  // already sent is already paid for, and the only question left is whether its answer is still
  // the one being waited for. They do come back out of order.
  const asked = useRef(0)

  const request = useCallback(
    (body: FormValues): void => {
      const bridge = getBridge()
      if (!bridge || !modelId) return

      sentAt.current = Date.now()
      const ticket = ++asked.current
      void bridge.scenario
        .estimateCost(modelId, body)
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
    [modelId],
  )

  // A panel closed mid-pause must not ask for the price of a form that is no longer on screen.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  // Another model is another price list, so the figure of the one before must not stay on the
  // button. Adjusted during the render rather than in an effect: React re-renders before it
  // commits, so the stale figure is never drawn once.
  const [pricedModel, setPricedModel] = useState(modelId)
  if (pricedModel !== modelId) {
    setPricedModel(modelId)
    setEstimate(null)
  }

  const onValuesChange = useCallback(
    (body: FormValues): void => {
      if (!priceable(fields, body)) return

      // Typing a word back to what it already was must not buy the same answer twice. Keyed by
      // model as well: two models can price the very same body differently.
      const shape = `${modelId ?? ''}:${JSON.stringify(body)}`
      if (shape === priced.current) return

      if (timer.current !== null) clearTimeout(timer.current)
      const since = Date.now() - sentAt.current
      const wait = Math.max(ESTIMATE_DEBOUNCE_MS, ESTIMATE_MIN_INTERVAL_MS - since)

      timer.current = setTimeout(() => {
        priced.current = shape
        request(body)
      }, wait)
    },
    [fields, modelId, request],
  )

  return { estimate, onValuesChange }
}
