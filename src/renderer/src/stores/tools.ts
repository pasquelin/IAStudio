import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isHorizontal, type ToolId, type ToolZone } from '@shared/domain/tool'

export const MIN_SIZE = 140

/** Room the documents area must keep, whatever the side panels ask for. */
export const MIN_CENTER = 240

type OpenByZone = Partial<Record<ToolZone, ToolId | null>>
type SizesByZone = Partial<Record<ToolZone, number>>

type ToolsState = {
  open: OpenByZone
  sizes: SizesByZone
  /** Last clicked zone: the one whose rail icon gets accented. */
  focusedZone: ToolZone | null
  toggle: (zone: ToolZone, tool: ToolId) => void
  close: (zone: ToolZone) => void
  focus: (zone: ToolZone | null) => void
  /** `available`: the container's dimension along the zone's axis. */
  resize: (zone: ToolZone, size: number, available: number) => void
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

const DEFAULT_OPEN: OpenByZone = {
  left: 'explorer',
  right: 'generator',
  bottom: 'assets',
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
export function clamp(size: number, available: number, opposite: number): number {
  const ceiling = Math.max(MIN_SIZE, Math.round(available - opposite - MIN_CENTER))
  return Math.min(ceiling, Math.max(MIN_SIZE, Math.round(size)))
}

function sizeOf(sizes: SizesByZone, zone: ToolZone, open: OpenByZone): number {
  return open[zone] ? (sizes[zone] ?? DEFAULT_SIZES[zone]) : 0
}

export const useTools = create<ToolsState>()(
  persist(
    set => ({
      open: DEFAULT_OPEN,
      sizes: {},
      focusedZone: null,

      toggle: (zone, tool) =>
        set(state => {
          const alreadyOpen = state.open[zone] === tool
          return {
            open: { ...state.open, [zone]: alreadyOpen ? null : tool },
            focusedZone: alreadyOpen ? null : zone,
          }
        }),

      close: zone =>
        set(state => ({
          open: { ...state.open, [zone]: null },
          focusedZone: state.focusedZone === zone ? null : state.focusedZone,
        })),

      focus: zone => set({ focusedZone: zone }),

      resize: (zone, size, available) =>
        set(state => ({
          sizes: {
            ...state.sizes,
            [zone]: clamp(size, available, sizeOf(state.sizes, OPPOSITE[zone], state.open)),
          },
        })),

      fit: (width, height) =>
        set(state => {
          const sizes = { ...state.sizes }
          for (const zone of Object.keys(OPPOSITE) as ToolZone[]) {
            const stored = sizes[zone]
            if (stored === undefined) continue
            const available = isHorizontal(zone) ? height : width
            sizes[zone] = clamp(stored, available, sizeOf(state.sizes, OPPOSITE[zone], state.open))
          }
          return { sizes }
        }),

      reset: () => set({ open: DEFAULT_OPEN, sizes: {}, focusedZone: null }),
    }),
    {
      name: 'scenario-studio:tools',
      // Bumped whenever a `ToolId` is renamed or dropped, or the shape changes: a stale entry
      // would reach `TOOL_COMPONENTS[tool]`, come back undefined, and blank the window on
      // startup. Version 1 also held a `collapsed` map, which no longer exists.
      version: 2,
      /**
       * Without this, zustand discards the whole persisted state on a version bump — and with
       * it which tool is open in each zone and the size the user gave every panel. Dropping a
       * field should not cost someone their layout: the fields that survived are kept, and the
       * one that went is simply not read.
       */
      migrate: persisted => (typeof persisted === 'object' ? persisted : undefined),
      // Focus is session state: restoring it would accent a zone on startup that the user
      // never touched.
      partialize: state => ({ open: state.open, sizes: state.sizes }),
    },
  ),
)
