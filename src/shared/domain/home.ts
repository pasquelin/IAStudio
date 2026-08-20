import { reconcileOrder } from './order'

/**
 * The home screen's registry, shared by both processes. It sits here for the same reason as
 * `domain/tool.ts`: the settings carry the user's order and the main process validates them,
 * so the list of sections cannot live in the renderer alone.
 *
 * The renderer enriches these ids with icons and components; nothing here knows about React.
 */

/**
 * A band of the page, and only that. Twelve ids left this union for `domain/tool.ts` — six on
 * 10 August, the last six on 11 August. A section is what the CENTRE stacks; anything the rails
 * hold is a placement, and the two registries never name the same thing.
 *
 * `tools` came back from that list on 12 August, and it is the one that did: a list of ten things
 * the studio can start is read ACROSS, in a grid, and a 320-pixel column turned it into a ladder
 * nobody scans. The three left are the three that earn the width — what the studio puts forward,
 * what it can start, and the feed that pages as it is scrolled. Everything else reads better in
 * a column.
 */
export type HomeSectionId = 'spotlight' | 'tools' | 'explore'

export type HomeSectionEntry = {
  id: HomeSectionId
  /**
   * Whether the band needs an API key to draw anything at all.
   *
   * A flag and not a list of requirements. It WAS a list, and its second value — a project had to
   * be open — went with the four bands that listed what a folder held, which are panels now: a
   * closed folder is an empty state there, not a reason to disappear. What the list then became
   * was a loop asking one question several times, where a second value added later would have
   * compiled, passed every test, and silently meant "api".
   */
  requiresApi?: boolean
  /**
   * Sections the user may not hide. Together they are what keeps the screen from ever being
   * empty — which is why `home.test.ts` demands that no pinned section need a key.
   */
  pinned?: boolean
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
  { id: 'spotlight', pinned: true },
  // Pinned for the same promise the spotlight carries, and it is the stronger half of it: this
  // is the one band that says something on a machine with no key, no project and no history.
  { id: 'tools', pinned: true },
  { id: 'explore', requiresApi: true, anchored: true },
]

export const HOME_SECTION_IDS: readonly HomeSectionId[] = HOME_SECTIONS.map(entry => entry.id)

/** What the settings keep per section. The order of the array IS the order on screen. */
export type HomeSectionSetting = {
  id: HomeSectionId
  visible: boolean
}

export function homeSectionOf(id: unknown): HomeSectionEntry | null {
  return HOME_SECTIONS.find(entry => entry.id === id) ?? null
}

function settingOf(entry: HomeSectionEntry): HomeSectionSetting {
  return { id: entry.id, visible: true }
}

export const DEFAULT_HOME_SECTIONS: readonly HomeSectionSetting[] = HOME_SECTIONS.map(settingOf)

/** What the studio can currently draw from. The answer comes from a store, never from here. */
export type HomeContext = {
  authenticated: boolean
}

function satisfies(entry: HomeSectionEntry, context: HomeContext): boolean {
  return entry.requiresApi !== true || context.authenticated
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

// The stored order is still reconciled and still read — the registry's own order decides what the
// centre stacks — but nothing moves a band any more, and that is a consequence rather than a
// decision: every band is either pinned or anchored, so none of them has anywhere to go.
// `movedHomeSection`, `canMoveHomeSection` and the `shown` narrowing they took went with the six
// bands that left on 11 August, and `tools` coming back on the 12th did not bring them with it —
// it arrived pinned. The day a MOVABLE band lands, rewriting them from the history is cheaper
// than having carried rules no case can reach.

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

/** Sections the user hid, so the home can offer them back without a trip to the preferences. */
export function hiddenHomeSections(stored: readonly HomeSectionSetting[]): HomeSectionId[] {
  return homeSections(stored)
    .filter(setting => !setting.visible && homeSectionOf(setting.id)?.pinned !== true)
    .map(setting => setting.id)
}
