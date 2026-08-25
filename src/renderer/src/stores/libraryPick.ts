import { create } from 'zustand'
import { actedOn } from '@/helpers/selection'
import { cloudIdOf, remoteRowId } from '@/panels/assets/rows'

type LibraryPickState = {
  /**
   * The ROW ids picked, in the order taken — what `Collection` paints. Not in the selection store
   * because nothing this panel lists has a catalogue row until it is downloaded.
   */
  picked: readonly string[]
  setPicked: (picked: readonly string[]) => void
}

export const useLibraryPick = create<LibraryPickState>()(set => ({
  picked: [],
  setPicked: picked => set({ picked }),
}))

/**
 * The LIBRARY ids a gesture on this line acts on, read at the moment it asks rather than handed
 * to every tile.
 *
 * 🛑 The two vocabularies meet here: what is picked are ROW ids, what a transfer takes are the
 * API's own. Compared without translating, a picked range never matched the line clicked and a
 * download of twelve silently fell back to one.
 */
export function pickedWith(cloudId: string): readonly string[] {
  return actedOn(useLibraryPick.getState().picked, remoteRowId(cloudId)).map(cloudIdOf)
}
