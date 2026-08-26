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
 * what it can start, and what it can run with.
 */
export type HomeSectionId = 'spotlight' | 'tools' | 'models' | 'news'

export type HomeSectionEntry = {
  id: HomeSectionId
  /**
   * Sections the user may not hide. Together they are what keeps the screen from ever being
   * empty.
   */
  pinned?: boolean
  /**
   * Sections a machine with no cloud account cannot fill. They are left out entirely rather than
   * drawn over an apology — see `visibleHomeSections`.
   */
  requiresApi?: boolean
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
  // What this studio can actually run, and with what. It replaced the feed of everything
  // published on Scenario, which required a key to draw a single tile and answered a question
  // nobody opens the studio with — see `home/sections/ModelInventory`.
  { id: 'models' },
  // What is moving outside it. Last because it is about somebody else's work: the bands above
  // are about this machine, and a reader scrolls past them to reach it deliberately — and off a
  // machine with no cloud account, not at all.
  { id: 'news', requiresApi: true },
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
  return reconcileOrder(kept, HOME_SECTIONS.map(settingOf), setting => setting.id)
}

/** Whether this studio can fill the band at all — the condition both readings below share. */
function drawable(entry: HomeSectionEntry | null, hasApi: boolean): boolean {
  return hasApi || entry?.requiresApi !== true
}

/**
 * The sections to draw, in order — the whole of the "never an empty home" promise, and the reason
 * it is a pure function rather than a condition inside a component. It settles what the SETTINGS
 * and the account allow; a band may still take itself off the page over what it has READ, which
 * no pure function of these two arguments can know. `News` is the one that does.
 *
 * Two rules produce it: a pinned section is drawn whatever the user hid, and a section that needs
 * the cloud is left out of a studio that has no account for it.
 *
 * `hasApi` is passed rather than read, and is not optional: the caller is the only one that knows
 * whether the key has been TRIED yet, and a default would have this answer "no account" during
 * the second the window takes to find out.
 *
 * 🛑 The flag went away with the explore feed and came back with the news band. The models band
 * does NOT carry it: it is at its most useful on a machine with no key, since saying so is half
 * of what it is for.
 */
export function visibleHomeSections(
  stored: readonly HomeSectionSetting[],
  hasApi: boolean,
): readonly HomeSectionId[] {
  return homeSections(stored)
    .filter(setting => {
      const entry = homeSectionOf(setting.id)
      return drawable(entry, hasApi) && (entry?.pinned === true || setting.visible)
    })
    .map(setting => setting.id)
}

// The stored order is still reconciled and still read — the registry's own order decides what the
// centre stacks — but nothing moves a band any more, and that is a consequence rather than a
// decision: the menu that moved them went with the six bands that left on 11 August, and neither
// `tools` coming back on the 12th nor the models band replacing the feed brought it with them.
// The day a MOVABLE band lands, rewriting `movedHomeSection` from the history is cheaper than
// having carried rules no case can reach.

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

/**
 * Sections the user hid, so the home can offer them back without a trip to the preferences.
 *
 * `hasApi` for the same reason `visibleHomeSections` takes it: offering back a band this studio
 * cannot draw is a line that does nothing when clicked.
 */
export function hiddenHomeSections(
  stored: readonly HomeSectionSetting[],
  hasApi: boolean,
): HomeSectionId[] {
  return homeSections(stored)
    .filter(setting => {
      const entry = homeSectionOf(setting.id)
      return drawable(entry, hasApi) && !setting.visible && entry?.pinned !== true
    })
    .map(setting => setting.id)
}
