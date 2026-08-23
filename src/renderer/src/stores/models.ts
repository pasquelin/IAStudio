import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { partsOfRole, primaryRoleOf, type AiRoleId } from '@shared/domain/aiRole'
import { MODEL_FAMILIES, type ModelFamily } from '@shared/domain/model'
import type { FormValues } from '@/helpers/dynamicForm'
import {
  COLLECTION_PERSIST_VERSION,
  DEFAULT_COLLECTION_STATE,
  withoutSearch,
  type CollectionState,
} from '@/helpers/collectionState'

/**
 * Bumped past `COLLECTION_PERSIST_VERSION` because `selected` changed KEY, not shape: entries
 * filed per family have to be re-filed per employment or every space opens on no model at all.
 */
const MODELS_PERSIST_VERSION = COLLECTION_PERSIST_VERSION + 1

type Collections = Partial<Record<ModelFamily, CollectionState>>

/**
 * Every family's state as it goes to storage. Walks the families rather than the map's own
 * keys, so a key a rehydrated blob invented — a family that has since been renamed away — is
 * dropped instead of being written back out forever.
 */
function searchless(collections: Collections): Collections {
  const stored: Collections = {}
  for (const family of MODEL_FAMILIES) {
    const held = collections[family]
    if (held) stored[family] = withoutSearch(held)
  }

  return stored
}

/**
 * What a family's choice becomes once choices are filed per employment: the choice of its FIRST
 * one, which is exactly what read it before — `resolveModelForFamily` only ever looked at
 * `primaryRoleOf(family)`.
 */
function withRoleKeys(persisted: unknown): unknown {
  if (typeof persisted !== 'object' || persisted === null) return persisted
  const held = persisted as { selected?: Record<string, string> }
  if (!held.selected) return persisted

  const selected: Partial<Record<AiRoleId, string>> = {}
  for (const family of MODEL_FAMILIES) {
    const modelId = held.selected[family]
    const role = primaryRoleOf(family)
    if (modelId && role) selected[role] = modelId
  }

  return { ...held, selected }
}

type ModelsState = {
  /**
   * One choice per EMPLOYMENT, not per family — ADR-23 § C.
   *
   * Filed per family, choosing a model to retouch with replaced the one text-to-image was on:
   * the two are different pickings, and the same weights serve both. Keyed by `AiRoleId` so that
   * the cloud model a panel picked is remembered against the operation it was picked for.
   */
  selected: Partial<Record<AiRoleId, string>>
  /**
   * The browser's search, sort, thumbnail size and facets — one set per family, for the same
   * reason as the choice above and a sharper one.
   *
   * A SINGLE set was shared by all seven spaces, and `queryFrom` guarded only the facets a
   * family stops offering: Origin and Period are offered everywhere, so they crossed. Ticking
   * "Official" under Image emptied the Skyboxes space — none of its models were official under
   * the tag the origin was read from — and the state being persisted, it survived restarts. The
   * user filtered a space they never filtered.
   */
  collections: Collections
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
   * Files the choice under the EMPLOYMENT it was made for. Global to that employment: picking a
   * model to retouch with in one document is picking it for every retouch, which is what a
   * preference means. What it no longer touches is the other operations of the same family.
   */
  select: (role: AiRoleId, modelId: string) => void
  /** Picks the model AND the values to open its form on, in one write. */
  prepare: (role: AiRoleId, modelId: string, params: FormValues) => void
  setCollection: (family: ModelFamily, collection: CollectionState) => void
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
      collections: {},
      preset: {},
      prepared: null,

      select: (role, modelId) =>
        set(state => ({
          selected: { ...state.selected, [role]: modelId },
          prepared: null,
        })),

      prepare: (role, modelId, params) =>
        set(state => {
          // The form opens on the FAMILY, which is what a descriptor belongs to; the choice is
          // filed on the employment. Both, or an edit arms a model whose parameters never arrive.
          const parts = partsOfRole(role)
          if (parts === null) return state

          return {
            selected: { ...state.selected, [role]: modelId },
            preset: { ...state.preset, [parts.family]: params },
            prepared: parts.family,
          }
        }),

      setCollection: (family, collection) =>
        set(state => ({ collections: { ...state.collections, [family]: collection } })),

      dropPreparation: () => set(state => (state.prepared ? { prepared: null } : state)),
    }),
    {
      name: 'ia-studio:models',
      // Bumped with the shape of `CollectionState`: an entry missing `thumbnailSize` lays the
      // grid out in zero-wide columns, which reads as a panel that lost its content.
      //
      // NOT bumped for the split into `collections`, and no migration either: the field was
      // renamed, so a state written before it restores `selected` and leaves `collections`
      // empty — every space opens unfiltered once, which is exactly what has to happen to the
      // shared filter this replaces. The orphan entry is gone at the first write.
      version: MODELS_PERSIST_VERSION,
      migrate: (persisted, version) =>
        version >= MODELS_PERSIST_VERSION ? persisted : withRoleKeys(persisted),
      // The search text is deliberately dropped: restoring it would open the studio on a
      // narrowed catalogue nobody typed, which reads as a catalogue gone missing.
      partialize: state => ({
        selected: state.selected,
        collections: searchless(state.collections),
      }),
    },
  ),
)

/**
 * The state of one family's browser, defaulted here rather than at each reader — the shape
 * `canvasViewOf` and `arrangementOf` settled on. The shared constant is never rebuilt: a
 * selector returning a fresh object hands React a new snapshot on every render.
 */
export function modelCollectionOf(
  state: Pick<ModelsState, 'collections'>,
  family: ModelFamily,
): CollectionState {
  return state.collections[family] ?? DEFAULT_COLLECTION_STATE
}
