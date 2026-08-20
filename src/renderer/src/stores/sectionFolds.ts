import { create } from 'zustand'

/**
 * The order « fold everything » / « unfold everything » leaves behind, and what each mounted
 * section answers — in a store for the reason `videoTool` gives, the button living in the panel's
 * title row and the sections in its body.
 *
 * The sections are held because the offer cannot be a flag that merely flips: the inspector swaps
 * its whole face on every selection, so the sections that come back are new ones on their own
 * defaults, and a flag would then offer to unfold what is already open.
 */
export type SectionFoldsState = {
  /** Bumped per order. A section compares it to know an order arrived after the last it obeyed. */
  stamp: number
  /** What the last order asked for. Read only when `stamp` has moved. */
  wanted: boolean
  sectionsOpen: ReadonlyMap<string, boolean>
  /** Publishes what one section holds, and hands back the way to take it off again. */
  noteSection: (id: string, open: boolean) => () => void
  askAllSections: () => void
}

/** Whether the panel has anything left to fold — what the title button offers to do next. */
export function anySectionOpen(state: SectionFoldsState): boolean {
  return [...state.sectionsOpen.values()].some(Boolean)
}

export const useSectionFolds = create<SectionFoldsState>()((set, get) => ({
  stamp: 0,
  wanted: true,
  sectionsOpen: new Map(),

  noteSection: (id, open) => {
    set(held => ({ sectionsOpen: new Map(held.sectionsOpen).set(id, open) }))

    return () =>
      set(held => {
        const left = new Map(held.sectionsOpen)
        left.delete(id)
        return { sectionsOpen: left }
      })
  },

  askAllSections: () => set(held => ({ stamp: held.stamp + 1, wanted: !anySectionOpen(get()) })),
}))
