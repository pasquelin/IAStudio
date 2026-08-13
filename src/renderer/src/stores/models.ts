import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ModelFamily } from '@shared/domain/model'
import type { FormValues } from '@/helpers/dynamic-form'
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
  /**
   * Parameters the generator should open on, per family. Set by "regenerate with these" in the
   * inspector; kept out of the persisted state, since it belongs to one gesture and not to a
   * preference.
   */
  preset: Partial<Record<ModelFamily, FormValues>>
  /**
   * The family an action asked the generator to open on, when it is not the workspace's own —
   * Enlarge reaches for an upscaler. Without it the panel went on showing the image model it
   * already held: the picture the edit had just uploaded never appeared, and Generate would
   * have run the wrong model on it.
   *
   * A parenthesis, not a preference: it lasts until a model is picked by hand or the user
   * leaves the space — see `connectPreparation`.
   */
  prepared: ModelFamily | null

  /**
   * Files the choice under the model's own family, which makes a choice GLOBAL to that family:
   * picking an image model anywhere replaces the one the Image space was on. Assumed rather than
   * worked around: the alternative is a second table filed per surface, persisted and migrated,
   * to record a distinction — "chosen here" against "chosen there" — that nothing asks about.
   */
  select: (family: ModelFamily, modelId: string) => void
  /** Picks the model AND the values to open its form on, in one write. */
  prepare: (family: ModelFamily, modelId: string, params: FormValues) => void
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

      select: (family, modelId) =>
        set(state => ({
          selected: { ...state.selected, [family]: modelId },
          prepared: null,
        })),

      prepare: (family, modelId, params) =>
        set(state => ({
          selected: { ...state.selected, [family]: modelId },
          preset: { ...state.preset, [family]: params },
          prepared: family,
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
