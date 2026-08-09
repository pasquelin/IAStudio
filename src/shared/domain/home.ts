import { reconcileOrder } from './order'

/**
 * The home screen's registry, shared by both processes. It sits here for the same reason as
 * `domain/tool.ts`: the settings carry the user's order and the main process validates them,
 * so the list of sections cannot live in the renderer alone.
 *
 * The renderer enriches these ids with icons and components; nothing here knows about React.
 */

/** What a section cannot be drawn without. A section with none is drawable at all times. */
export type HomeRequirement = 'api' | 'project'

export type HomeSectionId =
  | 'spotlight'
  | 'tools'
  | 'projects'
  | 'creations'
  | 'byMode'
  | 'favorites'
  | 'library'
  | 'documents'
  | 'jobs'
  | 'activity'
  | 'usage'
  | 'similar'
  | 'spark'
  | 'explore'

export type HomeSectionEntry = {
  id: HomeSectionId
  requires: readonly HomeRequirement[]
  /**
   * Sections the user may not hide. Together they are what keeps the screen from ever being
   * empty — which is why `home.test.ts` demands that every pinned section require nothing.
   */
  pinned?: boolean
  /** How many items the section shows before the user says otherwise. */
  defaultLimit?: number
  /**
   * Held at the foot of the page, and not movable.
   *
   * For a band that never ends: the feed pages as it is scrolled, so anything below it can only
   * be reached by outrunning the fetches. Ordering is a preference; burying a section is not one
   * the menu should be able to express.
   */
  anchored?: boolean
}

/**
 * Every section, in the order a fresh install shows them. A section arrives here with the code
 * that draws it: an id nothing renders is a line in the settings nobody can act on.
 */
export const HOME_SECTIONS: readonly HomeSectionEntry[] = [
  { id: 'spotlight', requires: [], pinned: true },
  { id: 'tools', requires: [], pinned: true },
  { id: 'projects', requires: [], pinned: true, defaultLimit: 12 },
  { id: 'creations', requires: ['project'], defaultLimit: 12 },
  // No limit: the band is one counter per kind, and there are exactly six kinds.
  { id: 'byMode', requires: ['project'] },
  // Requires nothing: a recipe is kept outside every project, and the shelf is the one place
  // that still has something to show when no folder is open.
  { id: 'favorites', requires: [], defaultLimit: 12 },
  { id: 'library', requires: ['api'], defaultLimit: 12 },
  { id: 'documents', requires: ['project'], defaultLimit: 12 },
  { id: 'jobs', requires: ['api'], defaultLimit: 8 },
  { id: 'activity', requires: ['project'], defaultLimit: 6 },
  { id: 'similar', requires: ['api'] },
  { id: 'spark', requires: ['api'] },
  { id: 'usage', requires: ['api'], defaultLimit: 6 },
  // No limit: it is the one band that does not end — the grid pages as it is scrolled, so a
  // count would cap what the reader can reach rather than how much is drawn at once.
  { id: 'explore', requires: ['api'], anchored: true },
]

export const HOME_SECTION_IDS: readonly HomeSectionId[] = HOME_SECTIONS.map(entry => entry.id)

/**
 * How far a section's item count may be pushed. The same two numbers the section menu offers
 * and the settings refuse beyond, so a limit can no longer be raised on one side alone.
 */
export const HOME_LIMIT_MIN = 3
export const HOME_LIMIT_MAX = 48

/** What the settings keep per section. The order of the array IS the order on screen. */
export type HomeSectionSetting = {
  id: HomeSectionId
  visible: boolean
  /** Absent takes the registry's default — a stored number outlives a changed default. */
  limit?: number
}

export function homeSectionOf(id: unknown): HomeSectionEntry | null {
  return HOME_SECTIONS.find(entry => entry.id === id) ?? null
}

function settingOf(entry: HomeSectionEntry): HomeSectionSetting {
  return { id: entry.id, visible: true }
}

export const DEFAULT_HOME_SECTIONS: readonly HomeSectionSetting[] = HOME_SECTIONS.map(settingOf)

/** What the studio can currently draw from. Both answers come from stores, never from here. */
export type HomeContext = {
  authenticated: boolean
  hasProject: boolean
}

function satisfies(entry: HomeSectionEntry, context: HomeContext): boolean {
  return entry.requires.every(requirement =>
    requirement === 'api' ? context.authenticated : context.hasProject,
  )
}

/**
 * The stored order, cleaned of ids this version no longer knows and completed by the ones it
 * has added since. Every read and every write starts here: a user reordering a home whose
 * settings predate a section would otherwise write that section out of existence.
 *
 * What `reconcileOrder` buys here: an added section sits where it was designed to rather than
 * at the end, and a new band under the fold is a feature that ships invisible.
 */
export function homeSections(stored: readonly HomeSectionSetting[]): HomeSectionSetting[] {
  const kept = stored.filter(setting => homeSectionOf(setting.id) !== null)
  // Built here rather than reusing `DEFAULT_HOME_SECTIONS`: what the registry contributes ends up
  // in the caller's array, and a module constant handed out by reference is a shared mutable.
  const settings = reconcileOrder(kept, HOME_SECTIONS.map(settingOf), setting => setting.id)

  // Anchored bands are put back at the foot whatever the stored order says. Settings written by
  // an earlier version — or by hand — would otherwise place one mid-page, where its endless
  // scroll makes everything under it unreachable.
  return [...settings.filter(setting => !anchored(setting)), ...settings.filter(anchored)]
}

function anchored(setting: HomeSectionSetting): boolean {
  return homeSectionOf(setting.id)?.anchored === true
}

/**
 * The sections to draw, in order. This is the whole of the "never an empty home" promise, and
 * the reason it is a pure function rather than a condition inside a component.
 *
 * Two rules produce it: a section whose requirements are unmet is dropped rather than drawn
 * empty, and a pinned section is drawn whatever the user hid. Since every pinned section
 * requires nothing, the result can never be empty — a test holds both halves of that sentence.
 */
export function visibleHomeSections(
  stored: readonly HomeSectionSetting[],
  context: HomeContext,
): readonly HomeSectionId[] {
  return homeSections(stored)
    .filter(setting => {
      const entry = homeSectionOf(setting.id)
      if (!entry) return false
      return (entry.pinned === true || setting.visible) && satisfies(entry, context)
    })
    .map(setting => setting.id)
}

/** Which way a section is being moved. Positions are settings, not ids, so this is enough. */
export type HomeMove = 'up' | 'down'

/**
 * Where a section would land if it moved, or -1 when nothing is left to swap with.
 *
 * It steps over the sections that are not being drawn. Swapping with a hidden neighbour is a
 * write that changes the stored order and nothing on screen — an enabled row that does nothing,
 * which is exactly what `canMoveHomeSection` exists to prevent. Explore made it plain: it sits
 * last, behind three bands that need a project, so moving it up did nothing until one was open.
 *
 * `shown` absent means every section counts, which is what a caller with nothing hidden wants.
 */
function neighbourOf(
  sections: readonly HomeSectionSetting[],
  from: number,
  move: HomeMove,
  shown?: readonly HomeSectionId[],
): number {
  // Walked as a slice rather than by index: the bounds are then the array's own, and there is
  // no out-of-range case left to guard against.
  const ahead =
    move === 'up' ? [...sections.slice(0, from)].reverse() : [...sections.slice(from + 1)]

  for (const candidate of ahead) {
    // Nothing may be swapped past an anchored band either — that is how a section would end up
    // under a feed that never ends.
    if (anchored(candidate)) return -1
    if (!shown || shown.includes(candidate.id)) return sections.indexOf(candidate)
  }

  return -1
}

/** Whether the menu may offer the move at all — a row that cannot act is disabled, not silent. */
export function canMoveHomeSection(
  stored: readonly HomeSectionSetting[],
  id: HomeSectionId,
  move: HomeMove,
  shown?: readonly HomeSectionId[],
): boolean {
  if (homeSectionOf(id)?.anchored === true) return false

  const sections = homeSections(stored)
  const from = sections.findIndex(setting => setting.id === id)
  return from !== -1 && neighbourOf(sections, from, move, shown) !== -1
}

/**
 * The order after a section has been moved one place. Unchanged at either end: a section that
 * cannot move is a disabled row in the menu, never a write that quietly does nothing.
 */
export function movedHomeSection(
  stored: readonly HomeSectionSetting[],
  id: HomeSectionId,
  move: HomeMove,
  shown?: readonly HomeSectionId[],
): HomeSectionSetting[] {
  const sections = homeSections(stored)
  if (homeSectionOf(id)?.anchored === true) return sections

  const from = sections.findIndex(setting => setting.id === id)
  if (from === -1) return sections

  const to = neighbourOf(sections, from, move, shown)
  if (to === -1) return sections

  const moving = sections[from]
  const displaced = sections[to]
  if (!moving || !displaced) return sections

  sections[to] = moving
  sections[from] = displaced
  return sections
}

/** One field of one section, rewritten. Both writes the menu offers are shaped like this. */
function patchedHomeSection(
  stored: readonly HomeSectionSetting[],
  id: HomeSectionId,
  patch: Partial<HomeSectionSetting>,
): HomeSectionSetting[] {
  return homeSections(stored).map(setting =>
    setting.id === id ? { ...setting, ...patch } : setting,
  )
}

export function shownHomeSection(
  stored: readonly HomeSectionSetting[],
  id: HomeSectionId,
  visible: boolean,
): HomeSectionSetting[] {
  return patchedHomeSection(stored, id, { visible })
}

/** Clamped rather than refused: the menu offers a few values, and nothing else may reach here. */
export function limitedHomeSection(
  stored: readonly HomeSectionSetting[],
  id: HomeSectionId,
  limit: number,
): HomeSectionSetting[] {
  const bounded = Math.min(HOME_LIMIT_MAX, Math.max(HOME_LIMIT_MIN, Math.round(limit)))
  return patchedHomeSection(stored, id, { limit: bounded })
}

/** Sections the user hid, so the home can offer them back without a trip to the preferences. */
export function hiddenHomeSections(stored: readonly HomeSectionSetting[]): HomeSectionId[] {
  return homeSections(stored)
    .filter(setting => !setting.visible && homeSectionOf(setting.id)?.pinned !== true)
    .map(setting => setting.id)
}

/** How many items a section asks for, the stored number winning over the registry's default. */
export function homeSectionLimit(
  stored: readonly HomeSectionSetting[],
  id: HomeSectionId,
): number | undefined {
  const setting = stored.find(candidate => candidate.id === id)
  return setting?.limit ?? homeSectionOf(id)?.defaultLimit
}
