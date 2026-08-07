import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ModelFamily } from '@shared/domain/model'
import {
  COLLECTION_PERSIST_VERSION,
  DEFAULT_COLLECTION_STATE,
  type CollectionState,
} from '@/helpers/collection-state'

type ModelsState = {
  /**
   * One choice per family: the panel follows the active workspace, and switching from Image
   * to Video and back must not lose what was picked on either side.
   */
  selected: Partial<Record<ModelFamily, string>>
  collection: CollectionState

  select: (family: ModelFamily, modelId: string) => void
  setCollection: (collection: CollectionState) => void
}

/**
 * What the Models panel chose, held outside it so the generator can read it without the two
 * panels knowing about each other — they are separate tool windows and either may be closed.
 */
export const useModels = create<ModelsState>()(
  persist(
    set => ({
      selected: {},
      collection: DEFAULT_COLLECTION_STATE,

      select: (family, modelId) =>
        set(state => ({ selected: { ...state.selected, [family]: modelId } })),

      setCollection: collection => set({ collection }),
    }),
    {
      name: 'scenario-studio:models',
      // Bumped with the shape of `CollectionState`: an entry missing `thumbnailSize` lays the
      // grid out in zero-wide columns, which reads as a panel that lost its content.
      version: COLLECTION_PERSIST_VERSION,
      // The search text is deliberately dropped: restoring it would open the studio on a
      // narrowed catalogue nobody typed, which reads as a catalogue gone missing.
      partialize: state => ({
        selected: state.selected,
        collection: { ...state.collection, search: '' },
      }),
    },
  ),
)
