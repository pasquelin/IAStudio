import { useState } from 'react'

/**
 * A picture that fails to load leaves the browser's broken-image glyph in place. The URLs the
 * API signs expire, so this is not hypothetical — the placeholder has to take over.
 */
export function useLoadable(url?: string): { src?: string; onError: () => void } {
  const [broken, setBroken] = useState<string | null>(null)
  const usable = url && url !== broken ? url : undefined

  return { src: usable, onError: () => setBroken(url ?? null) }
}
