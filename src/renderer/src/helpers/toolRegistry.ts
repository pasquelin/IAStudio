import {
  mdiAlertCircleOutline,
  mdiChatOutline,
  mdiRunFast,
  mdiBookOpenPageVariantOutline,
  mdiCreationOutline,
  mdiFileTreeOutline,
  mdiFolderMultipleOutline,
  mdiFolderOutline,
  mdiFormatText,
  mdiHistory,
  mdiImageMultipleOutline,
  mdiLayersOutline,
  mdiSourceBranch,
  mdiTuneVariant,
  mdiVideoVintage,
} from '@mdi/js'
import {
  placementIn,
  serves,
  TOOL_PLACEMENTS,
  type ToolId,
  type ToolPlacement,
  type ToolSlot,
  type ToolSurface,
  type ToolZone,
  type ZoneSlots,
} from '@shared/domain/tool'
import { gitHoldsFolder } from '@shared/domain/git'
import { NODE_KINDS } from '@/engines/scene/nodeKinds'
import { accountsHoldLibrary, useAccounts } from '@/stores/accounts'
import { useDocuments } from '@/stores/documents'
import { useGit } from '@/stores/git'
import { homeIsVisible } from '@/stores/layouts'
import { useProject } from '@/stores/project'

export type Tool = {
  id: ToolId
  icon: string
  zone: ToolZone
  slot: ToolSlot
  surfaces: readonly ToolSurface[]
  solo?: true
}

const ICONS: Record<ToolId, string> = {
  // The same glyph the title bar wore until the assistant became a panel of its own.
  assistant: mdiChatOutline,
  layers: mdiLayersOutline,
  // From the scene registry: the rail icon and the panel's own empty state must not drift.
  meshes: NODE_KINDS.mesh.icon,
  lights: NODE_KINDS.light.icon,
  timeline: mdiVideoVintage,
  explorer: mdiFolderOutline,
  // The fork every version tool draws, and the one glyph nobody mistakes for a folder.
  git: mdiSourceBranch,
  // The same subject read as a line of time, which is what the band holds — and a glyph that is
  // neither the fork above it nor the film reel the montage wears.
  history: mdiHistory,
  scene: mdiFileTreeOutline,
  generator: mdiCreationOutline,
  inspector: mdiTuneVariant,
  assets: mdiImageMultipleOutline,
  // The home's own. `mdiFolderOutline` is the Explorer's and `mdiCreationOutline` the
  // generator's: a rail where two glyphs mean two things is a rail one reads twice.
  projects: mdiFolderMultipleOutline,
  animations: mdiRunFast,
  text: mdiFormatText,
  // An open book: what the project SAYS about itself, beside the folder that holds it and
  // the fork that tracks it. Neither of those two, and neither the sparkle of a generation.
  context: mdiBookOpenPageVariantOutline,
  // What the compiler had to say, and the rail already spends its braces on the Code space.
  problems: mdiAlertCircleOutline,
}

/**
 * Tool windows, IDE-style: they live on the edges, one per half of a zone at a time, and are
 * picked from the icon rail. Only the center carries tabs — those are documents, and a document has
 * a name; a tool has an icon.
 *
 * Placements come from the shared registry; this module only adds what needs `@mdi/js`.
 */
export const TOOLS: readonly Tool[] = TOOL_PLACEMENTS.map(placement => ({
  ...placement,
  icon: ICONS[placement.id],
}))

/** Indexed once: `TOOLS` never changes, so filtering it on every render is pure waste. */
const BY_ZONE = TOOLS.reduce<Record<ToolZone, Tool[]>>(
  (index, tool) => {
    index[tool.zone].push(tool)
    return index
  },
  { left: [], right: [], top: [], bottomLeft: [], bottomRight: [] },
)

/**
 * The tools of a zone that the surface actually has. A layer stack means nothing in the audio
 * space: its icon has no business sitting in that rail, and its panel none being restored there
 * by a layout arranged elsewhere.
 */
export function toolsInZone(zone: ToolZone, surface: ToolSurface): Tool[] {
  return BY_ZONE[zone].filter(tool => serves(tool, surface))
}

/** i18n key of a tool's title — never the displayed text. */
export function toolTitleKey(id: ToolId): string {
  return `panels.${id}`
}

/**
 * A tool's glyph, for the panel itself rather than for the rail.
 *
 * Exported so an empty state can wear the icon its rail button wears: the two drifting apart is
 * what `meshes` reading `NODE_KINDS.mesh.icon` above already guards against, one panel at a time.
 */
export function toolIcon(id: ToolId): string {
  return ICONS[id]
}

/** The answers the shared registry cannot give: they depend on state, which `shared/` cannot read. */
export function toolStateOf(): ToolState {
  return {
    hasProject: useProject.getState().project !== null,
    hasGit: gitHoldsFolder(useGit.getState().repository),
    hasCloud: accountsHoldLibrary(useAccounts.getState()),
    centreTaken: homeIsVisible() || Object.keys(useDocuments.getState().documents).length > 0,
  }
}

/** What a surface can offer beyond what the registry declares, each rule answered from a store. */
export type ToolState = {
  /** A project folder open, which is what the Explorer reads. */
  hasProject: boolean
  /**
   * The centre holding anything but the conversation — a document, or the home page, which has
   * no Dockview at all. False means the empty centre is staging the thread itself.
   */
  centreTaken: boolean
  /** Git holding the project folder, so there are versions to read. Kept honest by the shell. */
  hasGit: boolean
  /**
   * A key opening onto a remote library — see `accountsHoldLibrary`. Read off the account LIST
   * and never off `auth.authenticated`, which is the answer to a network round trip: an icon
   * keyed on that one would be absent for the first second of every launch.
   */
  hasCloud: boolean
}

/**
 * Whether a section can offer this panel at all.
 *
 * WHAT each placement needs is declared beside it, in the registry; this only answers whether the
 * studio has it. Written as a run of `if (id === …)` it grew a third arm within a week of the
 * second, each of them a rule about a panel sitting a file away from where the panel is declared.
 */
function canOffer(id: ToolId, surface: ToolSurface, state: ToolState): boolean {
  const requires = placementIn(id, surface)?.requires

  if (requires === 'project') return state.hasProject
  // `git` implies `project`, and the conjunction is not redundant: the repository is corrected
  // asynchronously, so a project just closed still reads `ready` until the next status lands.
  if (requires === 'git') return state.hasProject && state.hasGit
  if (requires === 'cloud') return state.hasCloud
  if (requires === 'centreTaken') return state.centreTaken
  return true
}

/**
 * One half, resolved: `undefined` is closed, `null` is open on no panel in particular, an id is
 * one the user chose. 🛑 Private — it cannot see the other half, so it does not know a `solo`
 * panel is silencing this one. Every reader goes through `shownTools`.
 */
function shownTool(
  tool: ToolId | null | undefined,
  zone: ToolZone,
  slot: ToolSlot,
  surface: ToolSurface,
  state: ToolState,
): ToolId | null {
  if (tool === undefined) return null
  if (tool === null) return firstToolIn(zone, slot, surface, state)

  // Zone AND half: a stored id that names neither is not this half's business, whether it
  // belongs to the other column, the other half, or to a band no placement ever cuts.
  const placement = placementIn(tool, surface)
  if (placement?.zone === zone && placement.slot === slot) {
    // The half falls back to what the section does put there rather than to the Models panel,
    // which the home does not have at all — it stood empty on a home with no project open.
    return canOffer(tool, surface, state) ? tool : firstToolIn(zone, slot, surface, state)
  }

  return firstToolIn(zone, slot, surface, state)
}

/** What a zone's halves hold, once resolved. `null` where the half draws nothing at all. */
export type ShownTools = { primary: ToolId | null; secondary: ToolId | null }

/**
 * Both halves at once, because one can silence the other: a `solo` panel takes the zone WHOLE.
 * Resolved here rather than in each of the three readers, two of which would contradict it.
 */
export function shownTools(
  slots: ZoneSlots | undefined,
  zone: ToolZone,
  surface: ToolSurface,
  state: ToolState,
): ShownTools {
  const primary = shownTool(slots?.primary, zone, 'primary', surface, state)
  if (primary !== null && isSolo(primary, surface)) return { primary, secondary: null }

  return { primary, secondary: shownTool(slots?.secondary, zone, 'secondary', surface, state) }
}

/** Whether this panel takes its zone whole where it stands. */
export function isSolo(id: ToolId, surface: ToolSurface): boolean {
  return placementIn(id, surface)?.solo === true
}

/**
 * The panel a section puts first in a half — what an unchosen half shows, and the fallback.
 * `sharing` skips the one taking the zone whole, which a half falling back beside it would
 * otherwise answer with again, swallowing the gesture just made.
 */
export function firstToolIn(
  zone: ToolZone,
  slot: ToolSlot,
  surface: ToolSurface,
  state: ToolState,
  sharing = false,
): ToolId | null {
  const first = toolsInZone(zone, surface).find(
    candidate =>
      candidate.slot === slot &&
      !(sharing && candidate.solo) &&
      canOffer(candidate.id, surface, state),
  )
  return first ? first.id : null
}

/** Where the panel sits on this surface, or `null` where it is not on offer right now. */
export function offeredPlacement(
  id: ToolId,
  surface: ToolSurface,
  state: ToolState,
): ToolPlacement | null {
  const placement = placementIn(id, surface)
  return placement && canOffer(id, surface, state) ? placement : null
}

/**
 * Every panel this section can currently open, across all zones. What the native menu is told,
 * since it lives in the main process and cannot ask a store.
 */
export function availableToolIds(surface: ToolSurface): ToolId[] {
  const state = toolStateOf()
  return TOOLS.filter(tool => serves(tool, surface) && canOffer(tool.id, surface, state)).map(
    tool => tool.id,
  )
}

/**
 * The tools of a zone this section can actually offer. Generating without a model is impossible,
 * so the generator is not merely disabled there — it is absent, and the rail shows what the
 * section can do rather than what it cannot.
 *
 * The state is passed in rather than read: `useAvailableTools` subscribes to it, and `canOffer`
 * stays module-private, which is what it was before the hook moved out.
 */
export function toolsAvailableIn(zone: ToolZone, surface: ToolSurface, state: ToolState): Tool[] {
  return toolsInZone(zone, surface).filter(tool => canOffer(tool.id, surface, state))
}
