import {
  mdiCubeOutline,
  mdiImageOutline,
  mdiPanoramaVariantOutline,
  mdiRun,
  mdiTextureBox,
  mdiVideoOutline,
  mdiVolumeHigh,
} from '@mdi/js'
import { ASSET_TYPES, type AssetType } from '@shared/domain/asset'
import { workspaceOfType } from '@shared/domain/assetKind'
import { type ModelFamily } from '@shared/domain/model'
import { HOME_SURFACE, type ToolSurface } from '@shared/domain/tool'
import {
  FAMILY_BY_WORKSPACE,
  WORKSPACE_IDS,
  workspaceOrder,
  type WorkspaceId,
} from '@shared/domain/workspace'

export type Workspace = {
  id: WorkspaceId
  icon: string
  /** Scenario model family the generator offers in this workspace, and files its choice under. */
  family: ModelFamily
}

const ICONS: Record<WorkspaceId, string> = {
  image: mdiImageOutline,
  video: mdiVideoOutline,
  '3d': mdiCubeOutline,
  audio: mdiVolumeHigh,
  textures: mdiTextureBox,
  skyboxes: mdiPanoramaVariantOutline,
}

/**
 * Which workspace an asset belongs to. `Record` both ways, so a new kind or a new workspace is
 * a compile error rather than an asset drawn under the wrong glyph.
 */
// Re-exported so the panels keep one import for everything workspace-shaped, while the table
// itself lives in `shared/` — the main process names shelves from it too.
export { workspaceOfType }

/**
 * A glyph of its own, or `null` to keep the one its workspace draws.
 *
 * Total on purpose: the moment two kinds share a space the workspace table stops telling them
 * apart — a motion and a character both live in 3D — so a new kind has to answer the question
 * rather than silently inherit a neighbour's cube.
 */
const OWN_ICON: Record<AssetType, string | null> = {
  image: null,
  video: null,
  audio: null,
  mesh: null,
  texture: null,
  skybox: null,
  animation: mdiRun,
}

/**
 * What stands for an asset when there is no picture to show it by. Read off the workspace table
 * rather than relisted: changing the video glyph in the rail must change it on the tiles too.
 */
export function assetIcon(type: AssetType): string {
  return OWN_ICON[type] ?? ICONS[workspaceOfType(type)]
}

/**
 * What each space has any use for — which is not the reverse of the table above.
 *
 * A space consumes more than it produces: the 3D one takes materials and skies as much as
 * meshes, and the texture one is fed by ordinary pictures. Video takes everything, because a
 * montage is where the others end up.
 *
 * This is what keeps takes out of the way while painting, without hiding anything that space
 * could actually accept — the shelf offers a way back to everything.
 */
const USED_BY_WORKSPACE: Record<WorkspaceId, readonly AssetType[]> = {
  image: ['image', 'texture', 'skybox'],
  video: ASSET_TYPES,
  '3d': ['mesh', 'animation', 'texture', 'skybox', 'image'],
  audio: ['audio'],
  textures: ['texture', 'image'],
  skyboxes: ['skybox', 'image'],
}

export function assetTypesOf(workspace: WorkspaceId): readonly AssetType[] {
  return USED_BY_WORKSPACE[workspace]
}

/**
 * Derived from the shared registry rather than relisted, the way `toolRegistry.ts` derives
 * from `TOOL_PLACEMENTS`: a new workspace is then declared once, and the compiler demands its
 * icon and its family instead of letting the list drift. Its LABEL it does not demand — that
 * one is guarded by `dynamic-keys.i18n.test.ts`.
 */
export const WORKSPACES: readonly Workspace[] = WORKSPACE_IDS.map(id => ({
  id,
  icon: ICONS[id],
  family: FAMILY_BY_WORKSPACE[id],
}))

/**
 * The same workspaces, in the order the user arranged. Both surfaces that draw the bar read
 * through here rather than mapping `WORKSPACES` themselves: the title bar and the home's tools
 * showed the same list, and reordering one of them alone would leave two truths on one screen.
 */
export function workspacesIn(stored: readonly WorkspaceId[]): Workspace[] {
  return workspaceOrder(stored).map(id => workspaceById(id))
}

/** i18n key of a workspace label — the label is never hardcoded. */
export function workspaceLabelKey(id: WorkspaceId): string {
  return `workspaces.${id}`
}

/**
 * Takes a plain string: the id may come from a persisted layout or from IPC, which is
 * exactly the case this function exists to reject.
 */
export function workspaceById(id: string): Workspace {
  const workspace = WORKSPACES.find(candidate => candidate.id === id)
  if (!workspace) throw new Error(`Unknown workspace: ${id}`)
  return workspace
}

/**
 * What a surface browses models by. The home generates nothing: it opens documents, it makes
 * none — and that is the ONE surface with no family at all.
 *
 * Written once because two readers ask it — the rail deciding whether to draw the generator, and
 * the edit that sends the user off to pick a model — and a second spelling is a second answer.
 */
export function familyOfSurface(surface: ToolSurface): ModelFamily | null {
  return surface === HOME_SURFACE ? null : workspaceById(surface).family
}
