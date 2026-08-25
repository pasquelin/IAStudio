import { create } from 'zustand'

type LibraryPickState = {
  /**
   * The library ids the remote browser has picked, in the order they were taken.
   *
   * In a store rather than in the panel's own state, and read at the moment a gesture asks: a
   * line's menu is raised on a right-click and gone a moment later, and handing two hundred
   * tiles the selection re-renders all of them on every click that changes it.
   *
   * They are the LIBRARY's ids and not the catalogue's, which is why they are not in the
   * selection store: nothing this panel lists has a catalogue row until it is downloaded.
   */
  picked: readonly string[]
  setPicked: (picked: readonly string[]) => void
}

export const useLibraryPick = create<LibraryPickState>()(set => ({
  picked: [],
  setPicked: picked => set({ picked }),
}))

/** What a gesture on one line acts on: the whole picked range where it is in it, else itself. */
export function pickedWith(id: string): readonly string[] {
  const { picked } = useLibraryPick.getState()
  return picked.includes(id) ? picked : [id]
}
