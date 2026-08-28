import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clamp } from '@shared/numeric'
import {
  BOTTOM_ZONES,
  familyOf,
  isBottom,
  isHorizontal,
  placementIn,
  placementOf,
  SURFACE_FAMILIES,
  workspacePlacementsOf,
  TOOL_SLOTS,
  TOOL_ZONES,
  type SurfaceFamily,
  type ToolId,
  type ToolSlot,
  type ToolSurface,
  type ToolZone,
  type ZoneSlots,
} from '@shared/domain/tool'
import { isRecord } from '@shared/guards'
import {
  firstToolIn,
  isSolo,
  shownTools,
  toolStateOf,
  type ToolState,
} from '@/helpers/toolRegistry'

export const MIN_SIZE = 140

/** Room the documents area must keep, whatever the side panels ask for. */
export const MIN_CENTER = 240

/** Room a split keeps for the half it is taken from. */
export const MIN_SPLIT = 100

/** Which tool each half of each zone currently shows. */
export type OpenByZone = Partial<Record<ToolZone, ZoneSlots>>
type SizesByZone = Partial<Record<ToolZone, number>>

/**
 * WHICH panels a family of surfaces has up. Kept per family, not once for the studio: the home's
 * left column is the Explorer and the workspaces' is generation, so one shared entry made closing
 * the first close the second, and naming either overwrite the other.
 */
export type Arrangement = {
  open: OpenByZone
}

/**
 * What a zone held before a `solo` panel took it whole. Beside `focusedZone` rather than inside
 * `arrangements`, which `partialize` writes: a column reopening by itself days later, on an
 * arrangement nobody remembers making, is not a restoration.
 */
export type StashedByZone = Partial<Record<SurfaceFamily, Partial<Record<ToolZone, ZoneSlots>>>>

/**
 * How wide and how tall the frame is — ONE set for the whole studio, where the panels are per
 * family. A column that changed width on the way to the home read as another window: the reason
 * the two were split is what each half HOLDS, and a length holds nothing.
 */
export type Lengths = {
  /** The zone's own length: a width for the side columns, a height for the strips. */
  sizes: SizesByZone
  /** Length the second half takes inside its zone, along the zone's other axis. */
  splits: SizesByZone
  /**
   * Width the band's LEFT zone takes while both halves draw. Unset means half each — a fraction
   * would have to be re-read on every resize, where a length is what the handle drags.
   */
  bandSplit?: number
}

type ToolsState = {
  arrangements: Record<SurfaceFamily, Arrangement>
  lengths: Lengths
  /** Last clicked zone: the one whose rail icon gets accented. */
  focusedZone: ToolZone | null
  /** What a `solo` panel put away, per family. Never persisted — see `StashedByZone`. */
  stashed: StashedByZone
  /** Brings a tool up in the half its placement declares, and focuses its zone. */
  show: (surface: ToolSurface, zone: ToolZone, tool: ToolId) => void
  close: (surface: ToolSurface, zone: ToolZone, slot: ToolSlot) => void
  focus: (zone: ToolZone | null) => void
  /** `available`: the container's dimension along the zone's axis. */
  resize: (zone: ToolZone, size: number, available: number) => void
  /** Moves the divider between a zone's two halves. */
  resplit: (zone: ToolZone, size: number, available: number) => void
  /** Moves the divider BETWEEN the band's two zones, which is a width. */
  resplitBand: (size: number, available: number) => void
  /** Re-clamps every length after the window changed size. */
  fit: (width: number, height: number) => void
  reset: () => void
}

/** The arrangement a surface reads and writes. One line, but it is the whole point of the split. */
export function arrangementOf(state: ToolsState, surface: ToolSurface): Arrangement {
  return state.arrangements[familyOf(surface)]
}

// The wider column is the one holding the generator: it renders a model's own form, and a
// narrow one wraps every field onto two lines.
export const DEFAULT_SIZES: Record<ToolZone, number> = {
  left: 320,
  right: 260,
  top: 180,
  bottomLeft: 240,
  bottomRight: 240,
}

/**
 * What a TOOL opens its zone at, where the zone's own width does not suit it.
 *
 * The assistant alone today, and the two numbers say why one table was not enough: a conversation
 * at 260 wraps every sentence onto three lines, and the layer stack at 460 is mostly gutter.
 * Read only while nothing has been dragged — a width the reader chose wins over both.
 */
const TOOL_SIZES: Partial<Record<ToolId, number>> = { assistant: 460 }

/** What a zone opens at, the tool it is showing first. */
export function defaultSizeOf(zone: ToolZone, shown: ToolId | null): number {
  return (shown === null ? undefined : TOOL_SIZES[shown]) ?? DEFAULT_SIZES[zone]
}

/**
 * The room a zone takes when nothing has been dragged — the WIDEST any family has it open at.
 *
 * Read while clamping the opposite column: under-report it and the other side may be dragged over
 * room this one is already drawing in, squeezing the centre past its floor.
 */
function undraggedSizeOf(zone: ToolZone, arrangements: Record<SurfaceFamily, Arrangement>): number {
  const held = SURFACE_FAMILIES.map(family => arrangements[family].open[zone]?.primary ?? null)
  return Math.max(DEFAULT_SIZES[zone], ...held.map(tool => defaultSizeOf(zone, tool)))
}

/**
 * The half that carries what the single `bottom` zone used to: the strip's height, stored once
 * because two halves lying at two heights would leave the frame above them in a step, and
 * whatever a layout written before the split still holds.
 */
const BAND_MAIN: ToolZone = 'bottomRight'

/** Where a zone's length is read and written — the band's halves share the one key. */
export function sizeKeyOf(zone: ToolZone): ToolZone {
  return isBottom(zone) ? BAND_MAIN : zone
}

/**
 * Which halves start open — and nothing about what they draw. Every one of them is `null`, so
 * each surface opens on the panel it declares first: the layers in Image, the shelf in Video,
 * the sky in Skyboxes, the models in the upper left of every space and the Explorer in the lower
 * left of each — and, on the home, the projects and the library.
 *
 * Every half a surface has is named here, and a workspace's lower left is no exception: two halves
 * of two exist so the generator stays visible WHILE the Explorer is read, and a half that starts
 * closed would be that arrangement withheld until someone goes looking for it in the rail.
 *
 * The home names ONE half per column since 13 August, which is every half it has left. A half a
 * surface does NOT have must stay unnamed: `isZoneOpen` reads the key rather than what it resolves
 * to, so a `secondary: null` here would keep each column reserving 320 px against the other long
 * after the screen stopped drawing anything in it — and `tools.test.ts` derives the expected set
 * from `TOOL_PLACEMENTS` rather than restating it, so dropping a placement fails here.
 */
export const DEFAULT_OPEN: Record<SurfaceFamily, OpenByZone> = {
  workspaces: {
    left: { primary: null, secondary: null },
    right: { primary: null, secondary: null },
    bottomRight: { primary: null },
  },
  home: {
    // Both halves of the left column, as every space has: the projects above, and under them
    // the one that is open, read as a folder.
    left: { primary: null, secondary: null },
    // The upper right, and it alone: the assistant, which this screen serves like every space —
    // one asks the studio to make something from here more than from anywhere else. There is no
    // lower right, an inspector having no selection to read on a screen holding no document.
    right: { primary: null },
    // The band, since 17 August, and it holds one thing: the history of the project that is
    // open. `null` means "the half is there and nothing was chosen", which is what leaves it to
    // the first tool the registry serves — and with no project open, that is no tool at all.
    bottomRight: { primary: null },
  },
}

export const DEFAULT_ARRANGEMENTS: Record<SurfaceFamily, Arrangement> = {
  workspaces: { open: DEFAULT_OPEN.workspaces },
  home: { open: DEFAULT_OPEN.home },
}

export const DEFAULT_LENGTHS: Lengths = { sizes: {}, splits: {} }

const OPPOSITE: Record<ToolZone, ToolZone> = {
  left: 'right',
  right: 'left',
  // The band as a whole faces the top strip: either half of it takes the same height off.
  top: BAND_MAIN,
  bottomLeft: 'top',
  bottomRight: 'top',
}

/**
 * Clamps a zone size against what the opposite zone already takes. Capping each side at half
 * the container independently would let left and right add up to the full width, leaving the
 * documents area at zero — and overflowing once the window shrinks.
 */
export function fitZoneSize(size: number, available: number, opposite: number): number {
  const ceiling = Math.max(MIN_SIZE, Math.round(available - opposite - MIN_CENTER))
  return clamp(Math.round(size), MIN_SIZE, ceiling)
}

/** Same idea one level down: neither half of a zone may swallow the other. */
export function fitSplit(size: number, available: number): number {
  const ceiling = Math.max(MIN_SPLIT, Math.round(available - MIN_SPLIT))
  return clamp(Math.round(size), MIN_SPLIT, ceiling)
}

/** The panel taking the zone whole right now, or `null` — the zone is shared. */
function soloShowing(
  surface: ToolSurface,
  zone: ToolZone,
  held: ZoneSlots | undefined,
  state: ToolState,
): ToolId | null {
  const primary = shownTools(held, zone, surface, state).primary
  return primary !== null && isSolo(primary, surface) ? primary : null
}

/**
 * The zone's halves after a panel is brought up, and the remaining stash. Nothing put away means
 * the solo panel is what an untouched half DRAWS, so the other falls to the first panel SHARING
 * the zone — left unnamed it would answer with the solo panel and swallow the gesture.
 */
function slotsShowing(
  state: ToolsState,
  surface: ToolSurface,
  zone: ToolZone,
  slot: ToolSlot,
  tool: ToolId,
): [ZoneSlots, StashedByZone] {
  const held = arrangementOf(state, surface).open[zone]
  if (isSolo(tool, surface)) return [{ [slot]: tool }, withStash(state, surface, zone, held ?? {})]

  const tools = toolStateOf()
  if (soloShowing(surface, zone, held, tools) === null) {
    return [{ ...(held ?? {}), [slot]: tool }, state.stashed]
  }

  // 🛑 Around what the zone already HOLDS, never instead of it: the other half is silenced by the
  // solo panel, not closed by it, and rebuilding from the shared panel alone shut the inspector.
  const back = stashOf(state, surface, zone) ?? sharedInstead(held, zone, surface, tools)
  return [{ ...back, [slot]: tool }, withoutStash(state, surface, zone)]
}

/** The zone as it stands, with the half the solo panel took given to the first panel sharing it. */
function sharedInstead(
  held: ZoneSlots | undefined,
  zone: ToolZone,
  surface: ToolSurface,
  state: ToolState,
): ZoneSlots {
  const shared = firstToolIn(zone, 'primary', surface, state, true)
  const next = { ...(held ?? {}) }
  if (shared === null) delete next.primary
  else next.primary = shared
  return next
}

/**
 * The zone's halves after one is closed, and the remaining stash.
 *
 * 🛑 Nothing put away closes THAT HALF, never the zone: the solo panel may be silencing a half
 * the reader chose, and wiping it would take a panel they never asked to close with it.
 */
function slotsClosing(
  state: ToolsState,
  surface: ToolSurface,
  zone: ToolZone,
  slot: ToolSlot,
): [ZoneSlots, StashedByZone] {
  const held = arrangementOf(state, surface).open[zone]
  const leaving = shownTools(held, zone, surface, toolStateOf())[slot]
  const stashed = stashOf(state, surface, zone)

  if (stashed && leaving !== null && isSolo(leaving, surface)) {
    return [stashed, withoutStash(state, surface, zone)]
  }

  const next = { ...(held ?? {}) }
  delete next[slot]
  return [next, state.stashed]
}

function stashOf(state: ToolsState, surface: ToolSurface, zone: ToolZone): ZoneSlots | undefined {
  return state.stashed[familyOf(surface)]?.[zone]
}

function withStash(
  state: ToolsState,
  surface: ToolSurface,
  zone: ToolZone,
  slots: ZoneSlots,
): StashedByZone {
  const family = familyOf(surface)
  return { ...state.stashed, [family]: { ...state.stashed[family], [zone]: slots } }
}

function withoutStash(state: ToolsState, surface: ToolSurface, zone: ToolZone): StashedByZone {
  const family = familyOf(surface)
  const held = { ...state.stashed[family] }
  delete held[zone]
  return { ...state.stashed, [family]: held }
}

/** True once either half holds something: an empty zone takes no room at all. */
function isZoneOpen(open: OpenByZone, zone: ToolZone): boolean {
  const slots = open[zone] ?? {}
  return TOOL_SLOTS.some(slot => slots[slot] !== undefined)
}

/** The band takes its height as soon as EITHER half holds something: the strip is one strip. */
function isBandOpen(open: OpenByZone): boolean {
  return BOTTOM_ZONES.some(zone => isZoneOpen(open, zone))
}

/**
 * Whether ANY surface has that zone open. One length now serves both families, so it is clamped
 * against the tightest of the two: a width the home could afford would overflow a space that
 * keeps the opposite column open.
 */
function isOpenAnywhere(arrangements: Record<SurfaceFamily, Arrangement>, zone: ToolZone): boolean {
  return SURFACE_FAMILIES.some(family =>
    isBottom(zone)
      ? isBandOpen(arrangements[family].open)
      : isZoneOpen(arrangements[family].open, zone),
  )
}

function sizeOf(
  lengths: Lengths,
  zone: ToolZone,
  arrangements: Record<SurfaceFamily, Arrangement>,
): number {
  return isOpenAnywhere(arrangements, zone)
    ? (lengths.sizes[sizeKeyOf(zone)] ?? undraggedSizeOf(zone, arrangements))
    : 0
}

/** One family's arrangement, patched — the others left as they were, which is the whole point. */
function written(
  state: { arrangements: Record<SurfaceFamily, Arrangement> },
  surface: ToolSurface,
  patch: Partial<Arrangement>,
): Record<SurfaceFamily, Arrangement> {
  const family = familyOf(surface)
  return { ...state.arrangements, [family]: { ...state.arrangements[family], ...patch } }
}

/** Every stored length, re-clamped to a window of this size. */
function fitted(
  lengths: Lengths,
  arrangements: Record<SurfaceFamily, Arrangement>,
  width: number,
  height: number,
): Lengths {
  const sizes = { ...lengths.sizes }
  const splits = { ...lengths.splits }

  for (const zone of TOOL_ZONES) {
    const stored = sizes[zone]
    if (stored === undefined) continue

    const available = isHorizontal(zone) ? height : width
    sizes[zone] = fitZoneSize(stored, available, sizeOf(lengths, OPPOSITE[zone], arrangements))

    // The divider lives inside the zone, along its other axis: left unclamped it ends up past
    // the bottom of a shrunken column, with no way to drag it back.
    const divider = splits[zone]
    if (divider === undefined) continue
    splits[zone] = fitSplit(divider, isHorizontal(zone) ? width : height)
  }

  // The band's own divider runs across the WHOLE width: it parts two zones rather than the two
  // halves of one, so it is clamped against the window and not against a zone's length.
  const bandSplit = lengths.bandSplit === undefined ? undefined : fitSplit(lengths.bandSplit, width)

  return { sizes, splits, bandSplit }
}

/**
 * Reads what version 2 wrote — one bare id per zone — and lands it in the slot that tool
 * declares today. A version bump must not cost someone the layout they arranged.
 */
export function openFrom(persisted: unknown): OpenByZone {
  if (!isRecord(persisted)) return DEFAULT_OPEN.workspaces

  const open: OpenByZone = {}
  for (const zone of TOOL_ZONES) {
    const slots = slotsFrom(Reflect.get(persisted, zone))
    if (slots) open[zone] = slots
  }

  // Up to version 14 the band was ONE zone called `bottom`. Read as an unknown key it would be
  // dropped, and everyone who had a montage or a shelf down there would find the band closed.
  const band = slotsFrom(Reflect.get(persisted, 'bottom'))
  if (band) open[BAND_MAIN] ??= band

  return openEverywhereItSits(open)
}

/**
 * Re-hangs every stored tool on the placements it declares today, and nowhere else.
 *
 * Two things ride on this. A tool open in one of its zones must be open in all of them, since
 * what is open is stored per zone — **no tool declares two workspace halves today**, the shelf
 * having given up its second on 17 August, so this half of the job currently has no instance;
 * it is kept because the registry still allows one and nothing here would notice. And a tool
 * must leave the zones it no longer declares: the generation panels held the upper right until
 * version 6, and the shelf held the band and the right column until 17 August.
 *
 * Rebuilding from the placements rather than filtering the stored map is what makes the second
 * one free, and what keeps a horizontal band whole — no placement cuts one.
 *
 * It never displaces a tool already there: an explicit choice outranks this repair.
 */
function openEverywhereItSits(open: OpenByZone): OpenByZone {
  const next: OpenByZone = {}
  // A zone that was open stays open, even once emptied: it holds its size and its handle.
  for (const zone of TOOL_ZONES) if (open[zone]) next[zone] = {}

  for (const zone of TOOL_ZONES) {
    for (const slot of TOOL_SLOTS) {
      const tool = open[zone]?.[slot]
      if (tool === undefined) continue

      // A half open on no panel in particular has no placement to follow: it stays where it was
      // opened, and every section reads it as the first panel it puts there.
      if (tool === null) {
        const target = (next[zone] ??= {})
        target[slot] ??= null
        continue
      }

      for (const placement of workspacePlacementsOf(tool)) {
        const target = (next[placement.zone] ??= {})
        // `??=`, so a named panel wins the half over one merely left on its default.
        target[placement.slot] ??= tool
      }
    }
  }
  return next
}

/**
 * What an older store comes back as, and the home starts on its default either way: every
 * version this runs for gave it fewer halves than it has.
 *
 * The workspaces' own arrangement is where the care is, and the shape it was written in is what
 * decides. **Version 9 is the line**: before it, one arrangement lay flat at the root — `open`,
 * `sizes`, `splits`; from it, `partialize` writes `{ arrangements: { workspaces, home } }`, and
 * reading THAT as the flat shape finds none of the three keys. It would answer the factory
 * defaults, which is every column width and every chosen panel of all seven spaces lost without
 * a word — the cost of a version bump that only meant to add a half to the home.
 */
export function migrateTools(
  persisted: unknown,
  version: number,
): { arrangements: Record<SurfaceFamily, Arrangement>; lengths: Lengths } | undefined {
  if (!isRecord(persisted)) return undefined

  const held: unknown = Reflect.get(persisted, 'arrangements')
  const workspaces = isRecord(held) ? Reflect.get(held, 'workspaces') : persisted

  return {
    arrangements: {
      workspaces: { open: openOf(workspaces, version) },
      home: DEFAULT_ARRANGEMENTS.home,
    },
    // The SPACES' lengths, and never the home's: up to version 15 each family kept its own, and
    // the spaces are the six a user drags every day where the home is passed through.
    lengths: lengthsOf(workspaces),
  }
}

/** The halves an older version had up, re-hung on the placements this one declares. */
function openOf(persisted: unknown, version: number): OpenByZone {
  if (!isRecord(persisted)) return DEFAULT_OPEN.workspaces

  const open = openFrom(Reflect.get(persisted, 'open'))
  // Up to version 7 every half named a panel, including the ones nobody had ever clicked — the
  // default did the naming. Kept as chosen, an untouched Image would still open on the explorer
  // rather than its layers, and no update would ever fix it.
  return version < 8 ? unchosen(open) : open
}

/** What that family was dragged to, now the studio's own. */
function lengthsOf(persisted: unknown): Lengths {
  if (!isRecord(persisted)) return DEFAULT_LENGTHS

  const bandSplit: unknown = Reflect.get(persisted, 'bandSplit')

  return {
    sizes: lengthsFrom(Reflect.get(persisted, 'sizes')),
    splits: lengthsFrom(Reflect.get(persisted, 'splits')),
    ...(typeof bandSplit === 'number' ? { bandSplit } : {}),
  }
}

/**
 * The lengths this version still has a zone for, plus the band's: up to version 14 the strip was
 * one zone called `bottom`, and what it was dragged to is the height of `bottomRight` today.
 */
function lengthsFrom(persisted: unknown): SizesByZone {
  if (!isRecord(persisted)) return {}

  const lengths: SizesByZone = {}
  for (const zone of TOOL_ZONES) {
    const stored: unknown = Reflect.get(persisted, zone)
    if (typeof stored === 'number') lengths[zone] = stored
  }

  const band: unknown = Reflect.get(persisted, 'bottom')
  if (typeof band === 'number') lengths[BAND_MAIN] ??= band

  return lengths
}

/** The same halves, open on no panel in particular — which section decides is then the section's. */
export function unchosen(open: OpenByZone): OpenByZone {
  const next: OpenByZone = {}
  for (const zone of TOOL_ZONES) {
    const slots = open[zone]
    if (!slots) continue

    const cleared: ZoneSlots = {}
    for (const slot of TOOL_SLOTS) if (slot in slots) cleared[slot] = null
    next[zone] = cleared
  }
  return next
}

function slotsFrom(stored: unknown): ZoneSlots | null {
  if (typeof stored === 'string') {
    const placement = placementOf(stored)
    return placement ? { [placement.slot]: placement.id } : {}
  }
  if (!isRecord(stored)) return null

  const slots: ZoneSlots = {}
  for (const slot of TOOL_SLOTS) {
    const value: unknown = Reflect.get(stored, slot)
    // An open half with no panel named keeps the half it was written in — there is no placement
    // to move it by, and every section answers it on its own.
    if (value === null) {
      slots[slot] = null
      continue
    }

    // Through `placementOf`, so an id no version knows any more is dropped rather than
    // reaching `toolDefinition` and blanking the window.
    const placement = placementOf(value)
    if (placement) slots[placement.slot] = placement.id
  }
  return slots
}

export const useTools = create<ToolsState>()(
  persist(
    set => ({
      arrangements: DEFAULT_ARRANGEMENTS,
      lengths: DEFAULT_LENGTHS,
      focusedZone: null,
      stashed: {},

      show: (surface, zone, tool) =>
        set(state => {
          const slot = placementIn(tool, surface)?.slot
          if (!slot) return state

          const { open } = arrangementOf(state, surface)
          if (open[zone]?.[slot] === tool) return { focusedZone: zone }

          const [slots, stashed] = slotsShowing(state, surface, zone, slot, tool)
          return {
            arrangements: written(state, surface, { open: { ...open, [zone]: slots } }),
            stashed,
            focusedZone: zone,
          }
        }),

      close: (surface, zone, slot) =>
        set(state => {
          const [slots, stashed] = slotsClosing(state, surface, zone, slot)
          const open = { ...arrangementOf(state, surface).open, [zone]: slots }

          return {
            arrangements: written(state, surface, { open }),
            stashed,
            focusedZone:
              !isZoneOpen(open, zone) && state.focusedZone === zone ? null : state.focusedZone,
          }
        }),

      focus: zone => set(state => (state.focusedZone === zone ? state : { focusedZone: zone })),

      // Both guarded: `persist` writes localStorage on every `set`, and a drag past the ceiling
      // clamps to the same number for as long as the pointer keeps going.
      resize: (zone, size, available) =>
        set(state => {
          const { lengths } = state
          const next = fitZoneSize(
            size,
            available,
            sizeOf(lengths, OPPOSITE[zone], state.arrangements),
          )
          const key = sizeKeyOf(zone)
          if (next === lengths.sizes[key]) return state
          return { lengths: { ...lengths, sizes: { ...lengths.sizes, [key]: next } } }
        }),

      resplit: (zone, size, available) =>
        set(state => {
          const next = fitSplit(size, available)
          if (next === state.lengths.splits[zone]) return state
          return {
            lengths: { ...state.lengths, splits: { ...state.lengths.splits, [zone]: next } },
          }
        }),

      resplitBand: (size, available) =>
        set(state => {
          const next = fitSplit(size, available)
          if (next === state.lengths.bandSplit) return state
          return { lengths: { ...state.lengths, bandSplit: next } }
        }),

      // The window is as wide for the home as for a workspace, and lengths re-clamped only while
      // one surface is in front would come back overflowing on the other.
      fit: (width, height) =>
        set(state => ({ lengths: fitted(state.lengths, state.arrangements, width, height) })),

      reset: () =>
        set({
          arrangements: DEFAULT_ARRANGEMENTS,
          lengths: DEFAULT_LENGTHS,
          focusedZone: null,
          // Left behind, a solo panel closed after a reset would give back the column the reset
          // had just cleared.
          stashed: {},
        }),
    }),
    {
      name: 'ia-studio:tools',
      // Bumped whenever a `ToolId` is renamed or dropped, RE-HUNG ON ANOTHER HALF, or the shape
      // changes: a stale entry would reach a tool no version knows, which `isKnownTool` drops —
      // a blank half where a panel used to be. `shownTool` substituting the half's first tool is
      // NOT a reason to skip the bump: it substitutes from the placements, and a half whose last
      // placement is what just left has nothing to offer.
      // Version 1 held a `collapsed` map, and 2 one tool per zone; 3 predates the
      // mesh and light panels, and 4 the asset shelf moving out of the bottom strip. 5 still
      // cut that strip in two and knew a `jobs` panel, which the status line carries now, and
      // 6 had the generation panels on the right, where everything else sits today, 7 named
      // a panel in every default half, which imposed one section's answer on the other five,
      // and 8 held ONE arrangement for the whole studio — the home then took the left column
      // the spaces keep for generation, and a click on either was a click on both. 9 gave the
      // home a left column and nothing else; it has two now, and a stored arrangement naming
      // only the first would withhold the right one from everyone who had ever opened the app.
      // 10 left the home's upper left closed, which is where the tools moved on 11 August: the
      // same withholding, one half further in. 11 named that half and 12 unnamed it, the tools
      // having gone back to the centre; 13 gives it to the projects, which came up from the half
      // below. Everyone who ever launched 12 carries its `left: { secondary: null }` — the upper
      // half unnamed, so closed, and the projects never drawn at all. Not the minority who had
      // clicked: the whole installed base, on the panel the surface exists to open on.
      // 14 gives the home its lower left, where the Explorer now reads the project that is
      // open. Same withholding as every bump above it if left alone: a stored arrangement
      // naming only the upper half is a half nobody could have closed, and the panel the plan
      // put there would be invisible to the whole installed base.
      // 15 splits the band in two — `bottom` becomes `bottomLeft` and `bottomRight`, and every
      // panel that lay in it hangs on the right one. What was open is rebuilt from the
      // placements, so only the strip's stored HEIGHT needs moving; `lengthsFrom` does it.
      // 16 takes the LENGTHS out of the per-family arrangement: the split of version 8 was about
      // what each half HOLDS, and a length holds nothing — the right column changed width on the
      // way to the home for no reason anyone had chosen. The spaces' lengths become the studio's.
      // 17 drops `channels` and `styles`, which became sections of the inspector: the upper right
      // of Materials declares nothing now, and a stored arrangement still naming one of them would
      // keep it written for ever — `openEverywhereItSits` only reads what a bump makes it read.
      // 18 is `models` leaving the docks for the settings, and it is the SAME rule: without the
      // bump `migrate` never runs, and every installed arrangement keeps naming a dead panel.
      // 19 is `library` leaving the home, and it costs one thing more than 17 and 18 did: it was
      // the only panel of the home's RIGHT column, so an unmigrated arrangement keeps that zone
      // OPEN — `openEverywhereItSits` keeps a zone that was open even once emptied — and the
      // whole installed base would carry a 260 px column drawing nothing, with a handle to drag.
      // 20 is the assistant ARRIVING in that same column, and it costs the mirror image: the home
      // gained a right zone it never had, and an unmigrated arrangement — which names the halves
      // it knew and no others — leaves it CLOSED for ever. `migrate` rebuilds the home from the
      // defaults, so the bump IS the fix; a `ToolId` added is a bump like a `ToolId` dropped.
      version: 20,
      migrate: migrateTools,
      // Focus is session state: restoring it would accent a zone on startup that the user
      // never touched.
      partialize: state => ({ arrangements: state.arrangements, lengths: state.lengths }),
    },
  ),
)
