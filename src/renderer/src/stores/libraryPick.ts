import { create } from 'zustand'
import { actedOn } from '@/helpers/selection'

type LibraryPickState = {
  /**
   * The library ids picked, in the order taken. Not in the selection store because they are the
   * LIBRARY's: nothing this panel lists has a catalogue row until it is downloaded.
   */
  picked: readonly string[]
  setPicked: (picked: readonly string[]) => void
}

export const useLibraryPick = create<LibraryPickState>()(set => ({
  picked: [],
  setPicked: picked => set({ picked }),
}))

/** What a gesture acts on, read at the moment it asks rather than handed to every tile. */
export function pickedWith(id: string): readonly string[] {
  return actedOn(useLibraryPick.getState().picked, id)
}
