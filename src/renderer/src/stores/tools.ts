import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ToolId, ToolZone } from '@/app/tools'

export const MIN_SIZE = 140

/**
 * A tool zone never takes more than half the window: beyond that it stops being a side panel
 * and starts being the center disappearing.
 */
export const MAX_SHARE = 0.5

type OpenByZone = Partial<Record<ToolZone, ToolId | null>>
type SizesByZone = Partial<Record<ToolZone, number>>
type CollapsedByZone = Partial<Record<ToolZone, boolean>>

type ToolsState = {
  open: OpenByZone
  sizes: SizesByZone
  collapsed: CollapsedByZone
  /** Last clicked zone: the one whose rail icon gets accented. */
  focusedZone: ToolZone | null
  toggle: (zone: ToolZone, tool: ToolId) => void
  close: (zone: ToolZone) => void
  collapse: (zone: ToolZone) => void
  focus: (zone: ToolZone | null) => void
  /** `available`: the container's dimension, of which we never take more than `MAX_SHARE`. */
  resize: (zone: ToolZone, size: number, available: number) => void
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

/**
 * Clamps a zone size. The ceiling is relative to the window rather than a constant: on a wide
 * screen a 720 px panel bothers nobody; on a narrow window it swallows the center.
 */
export function clamp(size: number, available: number): number {
  return Math.min(Math.round(available * MAX_SHARE), Math.max(MIN_SIZE, Math.round(size)))
}

export const useTools = create<ToolsState>()(
  persist(
    (set, get) => ({
      open: DEFAULT_OPEN,
      sizes: {},
      collapsed: {},
      focusedZone: null,

      toggle: (zone, tool) =>
        set(state => {
          const alreadyOpen = state.open[zone] === tool
          // Clicking a collapsed tool's icon again expands it rather than closing it:
          // otherwise the only way back from a collapsed panel would be to close it first.
          if (alreadyOpen && state.collapsed[zone]) {
            return { collapsed: { ...state.collapsed, [zone]: false }, focusedZone: zone }
          }
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

      collapse: zone => set(state => ({ collapsed: { ...state.collapsed, [zone]: true } })),

      focus: zone => set({ focusedZone: zone }),

      resize: (zone, size, available) =>
        set({ sizes: { ...get().sizes, [zone]: clamp(size, available) } }),

      reset: () => set({ open: DEFAULT_OPEN, sizes: {}, collapsed: {}, focusedZone: null }),
    }),
    {
      name: 'scenario-studio:tools',
      // Focus is session state: restoring it would accent a zone on startup that the user
      // never touched.
      partialize: state => ({ open: state.open, sizes: state.sizes, collapsed: state.collapsed }),
    },
  ),
)
