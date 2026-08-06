import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isHorizontal, type ToolId, type ToolZone } from '@shared/domain/tool'

export const MIN_SIZE = 140

/** Room the documents area must keep, whatever the side panels ask for. */
export const MIN_CENTER = 240

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
      collapsed: {},
      focusedZone: null,

      toggle: (zone, tool) =>
        set(state => {
          const alreadyOpen = state.open[zone] === tool
          // Clicking a collapsed tool's icon again expands it rather than closing it —
          // otherwise a collapsed panel could only be dismissed, never restored in place.
          if (alreadyOpen && state.collapsed[zone]) {
            return { collapsed: { ...state.collapsed, [zone]: false }, focusedZone: zone }
          }
          return {
            open: { ...state.open, [zone]: alreadyOpen ? null : tool },
            // A different tool in a collapsed zone must arrive expanded, otherwise the click
            // only swaps the title and looks like it did nothing.
            collapsed: { ...state.collapsed, [zone]: false },
            focusedZone: alreadyOpen ? null : zone,
          }
        }),

      close: zone =>
        set(state => ({
          open: { ...state.open, [zone]: null },
          // Clearing `collapsed` too: it would otherwise outlive the panel, and the tool
          // would come back collapsed, without even its resize handle.
          collapsed: { ...state.collapsed, [zone]: false },
          focusedZone: state.focusedZone === zone ? null : state.focusedZone,
        })),

      // A toggle, not a one-way switch: the header stays visible when collapsed, so the
      // button is still there and must do something on the second click.
      collapse: zone =>
        set(state => ({ collapsed: { ...state.collapsed, [zone]: !state.collapsed[zone] } })),

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

      reset: () => set({ open: DEFAULT_OPEN, sizes: {}, collapsed: {}, focusedZone: null }),
    }),
    {
      name: 'scenario-studio:tools',
      // Bumped whenever a `ToolId` is renamed or dropped: a stale persisted id would reach
      // `TOOL_COMPONENTS[tool]`, come back undefined, and blank the window on startup.
      version: 1,
      // Focus is session state: restoring it would accent a zone on startup that the user
      // never touched.
      partialize: state => ({ open: state.open, sizes: state.sizes, collapsed: state.collapsed }),
    },
  ),
)
