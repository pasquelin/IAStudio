import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  familyOf,
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
} from '@shared/domain/tool'
import { isRecord } from '@shared/guards'

export const MIN_SIZE = 140

/** Room the documents area must keep, whatever the side panels ask for. */
export const MIN_CENTER = 240

/** Room a split keeps for the half it is taken from. */
export const MIN_SPLIT = 100

/**
 * One tool per half, so an icon click swaps rather than stacks. Key absent, the half is closed;
 * `null`, it is open on no panel in particular; an id, on the panel the user chose.
 *
 * That third state earns its keep: what is open is stored once for all the sections, while the
 * panel that comes first in a half differs in each — the layers in Image, the shelf in Video,
 * the sky in Skyboxes. An id there would impose one section's answer on the other five.
 */
type ZoneSlots = Partial<Record<ToolSlot, ToolId | null>>

/** Which tool each half of each zone currently shows. */
export type OpenByZone = Partial<Record<ToolZone, ZoneSlots>>
type SizesByZone = Partial<Record<ToolZone, number>>

/**
 * How one family of surfaces has arranged its zones. Kept per family, not once for the studio:
 * the home's left column is the Explorer and the workspaces' is generation, so one shared entry
 * made closing the first close the second, and naming either overwrite the other.
 */
export type Arrangement = {
  open: OpenByZone
  /** The zone's own length: a width for the side columns, a height for the strips. */
  sizes: SizesByZone
  /** Length the second half takes inside its zone, along the zone's other axis. */
  splits: SizesByZone
}

type ToolsState = {
  arrangements: Record<SurfaceFamily, Arrangement>
  /** Last clicked zone: the one whose rail icon gets accented. */
  focusedZone: ToolZone | null
  /** Brings a tool up in the half its placement declares, and focuses its zone. */
  show: (surface: ToolSurface, zone: ToolZone, tool: ToolId) => void
  close: (surface: ToolSurface, zone: ToolZone, slot: ToolSlot) => void
  focus: (zone: ToolZone | null) => void
  /** `available`: the container's dimension along the zone's axis. */
  resize: (surface: ToolSurface, zone: ToolZone, size: number, available: number) => void
  /** Moves the divider between a zone's two halves. */
  resplit: (surface: ToolSurface, zone: ToolZone, size: number, available: number) => void
  /** Re-clamps every zone of every family after the window changed size. */
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
  bottom: 240,
}

export const DEFAULT_SPLIT = 240

/**
 * Which halves start open — and nothing about what they draw. Every one of them is `null`, so
 * each surface opens on the panel it declares first: the layers in Image, the shelf in Video,
 * the sky in Skyboxes, the models on the left in every space, and the Explorer on the home.
 *
 * The home names only the left column, the one zone it has: an entry for the others would hold
 * a handle open beside a column nothing can fill.
 */
export const DEFAULT_OPEN: Record<SurfaceFamily, OpenByZone> = {
  workspaces: {
    left: { primary: null },
    right: { primary: null, secondary: null },
    bottom: { primary: null },
  },
  home: { left: { primary: null } },
}

export const DEFAULT_ARRANGEMENTS: Record<SurfaceFamily, Arrangement> = {
  workspaces: { open: DEFAULT_OPEN.workspaces, sizes: {}, splits: {} },
  home: { open: DEFAULT_OPEN.home, sizes: {}, splits: {} },
}

const OPPOSITE: Record<ToolZone, ToolZone> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
}

/**
 * Clamps a zone size against what the opposite zone already takes. Capping each side at half
 * the container independently would let left and right add up to the full width, leaving the
 * documents area at zero — and overflowing once the window shrinks.
 */
export function fitZoneSize(size: number, available: number, opposite: number): number {
  const ceiling = Math.max(MIN_SIZE, Math.round(available - opposite - MIN_CENTER))
  return Math.min(ceiling, Math.max(MIN_SIZE, Math.round(size)))
}

/** Same idea one level down: neither half of a zone may swallow the other. */
export function fitSplit(size: number, available: number): number {
  const ceiling = Math.max(MIN_SPLIT, Math.round(available - MIN_SPLIT))
  return Math.min(ceiling, Math.max(MIN_SPLIT, Math.round(size)))
}

/** True once either half holds something: an empty zone takes no room at all. */
function isZoneOpen(open: OpenByZone, zone: ToolZone): boolean {
  const slots = open[zone] ?? {}
  return TOOL_SLOTS.some(slot => slots[slot] !== undefined)
}

function sizeOf(sizes: SizesByZone, zone: ToolZone, open: OpenByZone): number {
  return isZoneOpen(open, zone) ? (sizes[zone] ?? DEFAULT_SIZES[zone]) : 0
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

/** Every stored length of one arrangement, re-clamped to a window of this size. */
function fitted(arrangement: Arrangement, width: number, height: number): Arrangement {
  const sizes = { ...arrangement.sizes }
  const splits = { ...arrangement.splits }

  for (const zone of TOOL_ZONES) {
    const stored = sizes[zone]
    if (stored === undefined) continue

    const available = isHorizontal(zone) ? height : width
    sizes[zone] = fitZoneSize(
      stored,
      available,
      sizeOf(arrangement.sizes, OPPOSITE[zone], arrangement.open),
    )

    // The divider lives inside the zone, along its other axis: left unclamped it ends up past
    // the bottom of a shrunken column, with no way to drag it back.
    const divider = splits[zone]
    if (divider === undefined) continue
    splits[zone] = fitSplit(divider, isHorizontal(zone) ? width : height)
  }

  return { ...arrangement, sizes, splits }
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
  return openEverywhereItSits(open)
}

/**
 * Re-hangs every stored tool on the placements it declares today, and nowhere else.
 *
 * Two things ride on this. A tool open in one of its zones must be open in all of them: the
 * shelf lies in the bottom band nearly everywhere and stands in the right column in Video and
 * Audio, while what is open is stored per zone — a layout written in one workspace would
 * otherwise leave it invisible in the others. And a tool must leave the zones it no longer
 * declares: the generation panels held the upper right until version 6, and own the left
 * column now.
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
 * What an older store comes back as. Every version this runs for predates the split, so the
 * whole stored arrangement is the workspaces': the home had no zones of its own to arrange. It
 * becomes theirs, and the home starts on its default — one column, open, on the Explorer.
 */
export function migrateTools(
  persisted: unknown,
  version: number,
): { arrangements: Record<SurfaceFamily, Arrangement> } | undefined {
  if (!isRecord(persisted)) return undefined

  return {
    arrangements: {
      workspaces: arrangementFrom(persisted, version),
      home: DEFAULT_ARRANGEMENTS.home,
    },
  }
}

/** One family's arrangement, read back from what an older version wrote. */
function arrangementFrom(persisted: unknown, version: number): Arrangement {
  if (!isRecord(persisted)) return DEFAULT_ARRANGEMENTS.workspaces

  const sizes: unknown = Reflect.get(persisted, 'sizes')
  const splits: unknown = Reflect.get(persisted, 'splits')
  const open = openFrom(Reflect.get(persisted, 'open'))

  return {
    // Up to version 7 every half named a panel, including the ones nobody had ever clicked —
    // the default did the naming. Kept as chosen, an untouched Image would still open on the
    // explorer rather than its layers, and no update would ever fix it.
    open: version < 8 ? unchosen(open) : open,
    sizes: isRecord(sizes) ? sizes : {},
    splits: isRecord(splits) ? splits : {},
  }
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
      focusedZone: null,

      show: (surface, zone, tool) =>
        set(state => {
          const slot = placementIn(tool, surface)?.slot
          if (!slot) return state

          const { open } = arrangementOf(state, surface)
          if (open[zone]?.[slot] === tool) return { focusedZone: zone }

          return {
            arrangements: written(state, surface, {
              open: { ...open, [zone]: { ...(open[zone] ?? {}), [slot]: tool } },
            }),
            focusedZone: zone,
          }
        }),

      close: (surface, zone, slot) =>
        set(state => {
          const next = { ...(arrangementOf(state, surface).open[zone] ?? {}) }
          delete next[slot]
          const open = { ...arrangementOf(state, surface).open, [zone]: next }

          return {
            arrangements: written(state, surface, { open }),
            focusedZone:
              !isZoneOpen(open, zone) && state.focusedZone === zone ? null : state.focusedZone,
          }
        }),

      focus: zone => set(state => (state.focusedZone === zone ? state : { focusedZone: zone })),

      // Both guarded: `persist` writes localStorage on every `set`, and a drag past the ceiling
      // clamps to the same number for as long as the pointer keeps going.
      resize: (surface, zone, size, available) =>
        set(state => {
          const { open, sizes } = arrangementOf(state, surface)
          const next = fitZoneSize(size, available, sizeOf(sizes, OPPOSITE[zone], open))
          if (next === sizes[zone]) return state
          return { arrangements: written(state, surface, { sizes: { ...sizes, [zone]: next } }) }
        }),

      resplit: (surface, zone, size, available) =>
        set(state => {
          const { splits } = arrangementOf(state, surface)
          const next = fitSplit(size, available)
          if (next === splits[zone]) return state
          return { arrangements: written(state, surface, { splits: { ...splits, [zone]: next } }) }
        }),

      // Every family, not just the one in front: the window is as wide for the home as for a
      // workspace, and an arrangement re-clamped only when visible comes back overflowing.
      fit: (width, height) =>
        set(state => {
          const arrangements = { ...state.arrangements }
          for (const family of SURFACE_FAMILIES) {
            arrangements[family] = fitted(arrangements[family], width, height)
          }
          return { arrangements }
        }),

      reset: () => set({ arrangements: DEFAULT_ARRANGEMENTS, focusedZone: null }),
    }),
    {
      name: 'scenario-studio:tools',
      // Bumped whenever a `ToolId` is renamed or dropped, or the shape changes: a stale entry
      // would reach a tool no version knows, which `isKnownTool` drops — a blank half where a
      // panel used to be. Version 1 held a `collapsed` map, and 2 one tool per zone; 3 predates the
      // mesh and light panels, and 4 the asset shelf moving out of the bottom strip. 5 still
      // cut that strip in two and knew a `jobs` panel, which the status line carries now, and
      // 6 had the generation panels on the right, where everything else sits today, 7 named
      // a panel in every default half, which imposed one section's answer on the other five,
      // and 8 held ONE arrangement for the whole studio — the home then took the left column
      // the spaces keep for generation, and a click on either was a click on both.
      version: 9,
      migrate: migrateTools,
      // Focus is session state: restoring it would accent a zone on startup that the user
      // never touched.
      partialize: state => ({ arrangements: state.arrangements }),
    },
  ),
)
