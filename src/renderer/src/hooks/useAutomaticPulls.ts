import { useEffect, useRef } from 'react'

export type AutomaticPulls = {
  /** What the listing is asking. The count starts afresh whenever it changes. */
  key: string
  /** How many rows are drawn right now. */
  drawn: number
  /** Below how many drawn rows the list keeps asking on its own. */
  wanted?: number
  /** How many pulls one key is worth. A bound, not a policy: every page costs a search quota. */
  max: number
  /** Whether a page is already on its way: a pull spent while one is in flight is spent on nothing. */
  fetching: boolean
  /**
   * A value that changes as an answer lands, which is what arms the next pull — a run of pages
   * drawing nothing moves nothing else. Omitted by a caller whose `ask` already takes a new
   * identity per answer.
   */
  answered?: unknown
  /** Asks for the next page, or nothing at all when there is nobody to ask. */
  ask: (() => void) | null
}

/**
 * Pulls a listing on its own while too little is drawn, up to a ceiling.
 *
 * A surface with no row has no end for a scroll to near, and a source CAN hold a list at nothing
 * while having more to give — a page the API narrowed away after answering does exactly that.
 * Past the ceiling it waits for a scroll, and the end-of-list gesture takes over.
 */
export function useAutomaticPulls({
  key,
  drawn,
  wanted = 1,
  max,
  fetching,
  answered,
  ask,
}: AutomaticPulls): void {
  const pulls = useRef(0)

  useEffect(() => {
    pulls.current = 0
  }, [key])

  useEffect(() => {
    if (!ask || fetching || drawn >= wanted || pulls.current >= max) return

    pulls.current += 1
    ask()
  }, [ask, drawn, wanted, max, fetching, answered])
}
