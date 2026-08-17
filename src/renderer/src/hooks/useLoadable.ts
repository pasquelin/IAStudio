import { useState } from 'react'
import { ASSET_SCHEME } from '@shared/domain/asset'

/** How many times a picture served from here is asked for again before the icon takes over. */
const RETRIES = 1

/**
 * Whether a failure is worth asking about twice — only what this process serves: an expired CDN
 * URL answers the same 403 however often it is asked. The retry leaves with no delay once the
 * failure is known, so only a fault healing within one round trip is won; a closed project is not.
 */
function worthRetrying(url: string): boolean {
  return url.startsWith(`${ASSET_SCHEME}:`)
}

/**
 * A picture that fails to load leaves the browser's broken-image glyph in place, so a placeholder
 * has to take over — but not on the first failure, for the pictures this process serves itself.
 *
 * `attempt` goes on the `<img>` as its `key`, and `useLoadable.contract.test.ts` holds every
 * caller to it: re-rendering the same `src` asks the browser for nothing at all.
 */
export function useLoadable(url?: string): { src?: string; attempt: number; onError: () => void } {
  const [tried, setTried] = useState({ url, attempt: 0 })

  // A fresh url starts its own count, during the render rather than after it: one that inherited
  // the budget of the picture before it would be given up on at its first failure.
  if (tried.url !== url) setTried({ url, attempt: 0 })

  const budget = url && worthRetrying(url) ? RETRIES : 0

  return {
    src: url && tried.attempt <= budget ? url : undefined,
    attempt: tried.attempt,
    onError: () => setTried(held => ({ url, attempt: held.attempt + 1 })),
  }
}
