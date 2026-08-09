import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ModelScope } from '@shared/domain/model'
import type { FormValues } from '@/helpers/dynamic-form'
import {
  COLLECTION_PERSIST_VERSION,
  DEFAULT_COLLECTION_STATE,
  type CollectionState,
} from '@/helpers/collection-state'

type ModelsState = {
  /**
   * One choice per scope: the panel follows the active workspace, and switching from Image
   * to Video and back must not lose what was picked on either side. The graph browses the
   * whole catalogue, so its choice is filed under `'all'` rather than under a family.
   */
  selected: Partial<Record<ModelScope, string>>
  collection: CollectionState
  /**
   * Parameters the generator should open on, per scope. Set by "regenerate with these" in the
   * inspector; kept out of the persisted state, since it belongs to one gesture and not to a
   * preference.
   */
  preset: Partial<Record<ModelScope, FormValues>>
  /**
   * The scope an action asked the generator to open on, when it is not the workspace's own —
   * Enlarge reaches for an upscaler. Without it the panel went on showing the image model it
   * already held: the picture the edit had just uploaded never appeared, and Generate would
   * have run the wrong model on it.
   *
   * A parenthesis, not a preference: it lasts until a model is picked by hand or the user
   * leaves the space — see `connectPreparation`.
   */
  prepared: ModelScope | null

  select: (scope: ModelScope, modelId: string) => void
  /** Picks the model AND the values to open its form on, in one write. */
  prepare: (scope: ModelScope, modelId: string, params: FormValues) => void
  setCollection: (collection: CollectionState) => void
  dropPreparation: () => void
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
      preset: {},
      prepared: null,

      select: (scope, modelId) =>
        set(state => ({ selected: { ...state.selected, [scope]: modelId }, prepared: null })),

      prepare: (scope, modelId, params) =>
        set(state => ({
          selected: { ...state.selected, [scope]: modelId },
          preset: { ...state.preset, [scope]: params },
          prepared: scope,
        })),

      setCollection: collection => set({ collection }),

      dropPreparation: () => set(state => (state.prepared ? { prepared: null } : state)),
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
