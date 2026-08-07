import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  isHorizontal,
  placementOf,
  TOOL_SLOTS,
  TOOL_ZONES,
  type ToolId,
  type ToolSlot,
  type ToolZone,
} from '@shared/domain/tool'
import { isRecord } from '@/helpers/guards'

export const MIN_SIZE = 140

/** Room the documents area must keep, whatever the side panels ask for. */
export const MIN_CENTER = 240

/** Room a split keeps for the half it is taken from. */
export const MIN_SPLIT = 100

/** One tool per half, so an icon click swaps rather than stacks. An absent key is a closed
 * half — there is no second way to say it. */
type ZoneSlots = Partial<Record<ToolSlot, ToolId>>
type OpenByZone = Partial<Record<ToolZone, ZoneSlots>>
type SizesByZone = Partial<Record<ToolZone, number>>

type ToolsState = {
  open: OpenByZone
  /** The zone's own length: a width for the side columns, a height for the strips. */
  sizes: SizesByZone
  /** Length the second half takes inside its zone, along the zone's other axis. */
  splits: SizesByZone
  /** Last clicked zone: the one whose rail icon gets accented. */
  focusedZone: ToolZone | null
  toggle: (zone: ToolZone, tool: ToolId) => void
  /** Brings a tool up and focuses its zone, leaving it up when it already was — unlike `toggle`. */
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

export const DEFAULT_SIZES: Record<ToolZone, number> = {
  left: 260,
  right: 320,
  top: 180,
  bottom: 240,
}

export const DEFAULT_SPLIT = 240

const DEFAULT_OPEN: OpenByZone = {
  left: { secondary: 'explorer' },
  right: { primary: 'generator' },
  bottom: { primary: 'assets' },
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
  return open
}

function slotsFrom(stored: unknown): ZoneSlots | null {
  if (typeof stored === 'string') {
    const placement = placementOf(stored)
    return placement ? { [placement.slot]: placement.id } : {}
  }
  if (!isRecord(stored)) return null

  const slots: ZoneSlots = {}
  for (const slot of TOOL_SLOTS) {
    // Through `placementOf`, so an id no version knows any more is dropped rather than
    // reaching `TOOL_COMPONENTS` and blanking the window.
    const placement = placementOf(Reflect.get(stored, slot))
    if (placement) slots[slot] = placement.id
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

      toggle: (zone, tool) =>
        set(state => {
          const slot = placementOf(tool)?.slot
          if (!slot) return state

          // Clicking the tool already up closes its half; clicking another swaps that half.
          const next = { ...(state.open[zone] ?? {}) }
          if (next[slot] === tool) delete next[slot]
          else next[slot] = tool

          const open = { ...state.open, [zone]: next }
          if (isZoneOpen(open, zone)) return { open, focusedZone: zone }
          // Emptying this zone must not steal the accent from whichever other zone had it.
          return { open, focusedZone: state.focusedZone === zone ? null : state.focusedZone }
        }),

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
      // mesh and light panels.
      version: 4,
      migrate: persisted => {
        if (typeof persisted !== 'object' || persisted === null) return undefined
        const sizes: unknown = Reflect.get(persisted, 'sizes')
        const splits: unknown = Reflect.get(persisted, 'splits')
        return {
          open: openFrom(Reflect.get(persisted, 'open')),
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
