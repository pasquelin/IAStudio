import { useCallback, useState } from 'react'

export type Folded = {
  /** The ids folded shut by hand. Everything not in it is open. */
  ids: ReadonlySet<string>
  toggle: (id: string) => void
  /** Opens them all again — what a list rebuilt from another question asks for. */
  reset: () => void
}

/**
 * What a tree drawn OPEN keeps folded.
 *
 * The other way round from `useFolderTree`, and that is the whole of it: a lazy tree remembers
 * what was opened because opening a folder is what reads it, while a list that already holds
 * every row it will ever hold is drawn open — a match hidden under a fold is a match nobody was
 * answered. Only what the hand closed has to be remembered.
 *
 * Two sources of the explorer had written the same five lines: the search and the domain view.
 */
export function useFolded(): Folded {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setIds(current => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  const reset = useCallback(() => setIds(new Set()), [])

  return { ids, toggle, reset }
}
