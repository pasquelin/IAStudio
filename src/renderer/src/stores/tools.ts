import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  isHorizontal,
  placementOf,
  workspacePlacementsOf,
  TOOL_SLOTS,
  TOOL_ZONES,
  type ToolId,
  type ToolSlot,
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
 * That third state earns its keep: what is open is stored once for all six sections, while the
 * panel that comes first in a half differs in each — the layers in Image, the shelf in Video,
 * the sky in Skyboxes. An id there would impose one section's answer on the other five.
 */
type ZoneSlots = Partial<Record<ToolSlot, ToolId | null>>

/** Which tool each half of each zone currently shows. */
export type OpenByZone = Partial<Record<ToolZone, ZoneSlots>>
type SizesByZone = Partial<Record<ToolZone, number>>

type ToolsState = {
  open: OpenByZone
  /** The zone's own length: a width for the side columns, a height for the strips. */
  sizes: SizesByZone
  /** Length the second half takes inside its zone, along the zone's other axis. */
  splits: SizesByZone
  /** Last clicked zone: the one whose rail icon gets accented. */
  focusedZone: ToolZone | null
  /** Brings a tool up in the half its placement declares, and focuses its zone. */
  show: (zone: ToolZone, tool: ToolId) => void
  close: (zone: ToolZone, slot: ToolSlot) => void
  focus: (zone: ToolZone | null) => void
  /** `available`: the container's dimension along the zone's axis. */
  resize: (zone: ToolZone, size: number, available: number) => void
  /** Moves the divider between a zone's two halves. */
  resplit: (zone: ToolZone, size: number, available: number) => void
  /** Re-clamps every zone after the window changed size. */
  fit: (width: number, height: number) => void
  reset: () => void
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
 * each section opens on the panel it declares first: the layers in Image, the shelf in Video,
 * the sky in Skyboxes, the models on the left everywhere.
 */
export const DEFAULT_OPEN: OpenByZone = {
  left: { primary: null },
  right: { primary: null, secondary: null },
  bottom: { primary: null },
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

/**
 * Reads what version 2 wrote — one bare id per zone — and lands it in the slot that tool
 * declares today. A version bump must not cost someone the layout they arranged.
 */
export function openFrom(persisted: unknown): OpenByZone {
  if (!isRecord(persisted)) return DEFAULT_OPEN

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
    // reaching `TOOL_COMPONENTS` and blanking the window.
    const placement = placementOf(value)
    if (placement) slots[placement.slot] = placement.id
  }
  return slots
}

export const useTools = create<ToolsState>()(
  persist(
    set => ({
      open: DEFAULT_OPEN,
      sizes: {},
      splits: {},
      focusedZone: null,

      show: (zone, tool) =>
        set(state => {
          const slot = placementOf(tool)?.slot
          if (!slot) return state
          if (state.open[zone]?.[slot] === tool) return { focusedZone: zone }

          return {
            open: { ...state.open, [zone]: { ...(state.open[zone] ?? {}), [slot]: tool } },
            focusedZone: zone,
          }
        }),

      close: (zone, slot) =>
        set(state => {
          const next = { ...(state.open[zone] ?? {}) }
          delete next[slot]
          const open = { ...state.open, [zone]: next }
          return {
            open,
            focusedZone:
              !isZoneOpen(open, zone) && state.focusedZone === zone ? null : state.focusedZone,
          }
        }),

      focus: zone => set(state => (state.focusedZone === zone ? state : { focusedZone: zone })),

      // Both guarded: `persist` writes localStorage on every `set`, and a drag past the ceiling
      // clamps to the same number for as long as the pointer keeps going.
      resize: (zone, size, available) =>
        set(state => {
          const next = fitZoneSize(size, available, sizeOf(state.sizes, OPPOSITE[zone], state.open))
          if (next === state.sizes[zone]) return state
          return { sizes: { ...state.sizes, [zone]: next } }
        }),

      resplit: (zone, size, available) =>
        set(state => {
          const next = fitSplit(size, available)
          if (next === state.splits[zone]) return state
          return { splits: { ...state.splits, [zone]: next } }
        }),

      fit: (width, height) =>
        set(state => {
          const sizes = { ...state.sizes }
          const splits = { ...state.splits }
          for (const zone of TOOL_ZONES) {
            const stored = sizes[zone]
            if (stored === undefined) continue
            const available = isHorizontal(zone) ? height : width
            sizes[zone] = fitZoneSize(
              stored,
              available,
              sizeOf(state.sizes, OPPOSITE[zone], state.open),
            )

            // The divider lives inside the zone, along its other axis: left unclamped it ends up
            // past the bottom of a shrunken column, with no way to drag it back.
            const divider = splits[zone]
            if (divider === undefined) continue
            splits[zone] = fitSplit(divider, isHorizontal(zone) ? width : height)
          }
          return { sizes, splits }
        }),

      reset: () => set({ open: DEFAULT_OPEN, sizes: {}, splits: {}, focusedZone: null }),
    }),
    {
      name: 'scenario-studio:tools',
      // Bumped whenever a `ToolId` is renamed or dropped, or the shape changes: a stale entry
      // would reach `TOOL_COMPONENTS[tool]`, come back undefined, and blank the window on
      // startup. Version 1 held a `collapsed` map, and 2 one tool per zone; 3 predates the
      // mesh and light panels, and 4 the asset shelf moving out of the bottom strip. 5 still
      // cut that strip in two and knew a `jobs` panel, which the status line carries now, and
      // 6 had the generation panels on the right, where everything else sits today, and 7 named
      // a panel in every default half, which imposed one section's answer on the other five.
      version: 8,
      migrate: (persisted, version) => {
        if (typeof persisted !== 'object' || persisted === null) return undefined
        const sizes: unknown = Reflect.get(persisted, 'sizes')
        const splits: unknown = Reflect.get(persisted, 'splits')
        const open = openFrom(Reflect.get(persisted, 'open'))
        return {
          // Up to version 7 every half named a panel, including the ones nobody had ever clicked
          // — the default did the naming. Kept as chosen, an untouched Image would still open on
          // the explorer rather than its layers, and no update would ever fix it.
          open: version < 8 ? unchosen(open) : open,
          sizes: isRecord(sizes) ? sizes : {},
          splits: isRecord(splits) ? splits : {},
        }
      },
      // Focus is session state: restoring it would accent a zone on startup that the user
      // never touched.
      partialize: state => ({ open: state.open, sizes: state.sizes, splits: state.splits }),
    },
  ),
)
