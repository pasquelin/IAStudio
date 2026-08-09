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
  // Last, and no limit: it is the one band that does not end — the grid pages as it is scrolled,
  // so a count would cap what the reader can reach rather than how much is drawn at once.
  { id: 'explore', requires: ['api'] },
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
 * An added section is placed where it was designed to sit rather than appended: nobody goes
 * looking in the preferences for a feature they have never seen, and a new section landing
 * under the fold is a feature that ships invisible.
 */
export function homeSections(stored: readonly HomeSectionSetting[]): HomeSectionSetting[] {
  const settings = stored.filter(setting => homeSectionOf(setting.id) !== null)

  for (const [index, entry] of HOME_SECTIONS.entries()) {
    if (settings.some(setting => setting.id === entry.id)) continue

    let at = 0
    for (const earlier of HOME_SECTIONS.slice(0, index)) {
      const found = settings.findIndex(setting => setting.id === earlier.id)
      if (found >= 0) at = found + 1
    }

    settings.splice(at, 0, settingOf(entry))
  }

  return settings
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

/** Where a section would land if it moved, or -1 when it is already at that end of the page. */
function neighbourOf(count: number, from: number, move: HomeMove): number {
  const at = from + (move === 'up' ? -1 : 1)
  return at >= 0 && at < count ? at : -1
}

/** Whether the menu may offer the move at all — a row that cannot act is disabled, not silent. */
export function canMoveHomeSection(
  stored: readonly HomeSectionSetting[],
  id: HomeSectionId,
  move: HomeMove,
): boolean {
  const sections = homeSections(stored)
  const from = sections.findIndex(setting => setting.id === id)
  return from !== -1 && neighbourOf(sections.length, from, move) !== -1
}

/**
 * The order after a section has been moved one place. Unchanged at either end: a section that
 * cannot move is a disabled row in the menu, never a write that quietly does nothing.
 */
export function movedHomeSection(
  stored: readonly HomeSectionSetting[],
  id: HomeSectionId,
  move: HomeMove,
): HomeSectionSetting[] {
  const sections = homeSections(stored)
  const from = sections.findIndex(setting => setting.id === id)
  if (from === -1) return sections

  const to = neighbourOf(sections.length, from, move)
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
