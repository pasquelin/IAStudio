import { useCallback } from 'react'
import { cn } from '@/helpers/cn'
import { TooltipHost } from '@/design/TooltipHost'
import { useLayouts } from '@/stores/layouts'
import { DEFAULT_SIZES, DEFAULT_SPLIT, useTools } from '@/stores/tools'
import { DocumentArea } from './DocumentArea'
import { Breadcrumb } from './Breadcrumb'
import { Footer } from './Footer'
import { JobsStatus } from './JobsStatus'
import { Rail } from './Rail'
import { ResizeHandle } from '@/design/ResizeHandle'
import { AccountSelect } from './AccountSelect'
import { TitleBar } from './TitleBar'
import {
  isHorizontal,
  isLeading,
  type ToolId,
  type ToolSlot,
  type ToolZone,
} from '@shared/domain/tool'
import { shownTool, useHasModel } from '@/helpers/tool-registry'
import { Panel } from '@/design/Panel'
import { ToolWindow } from './ToolWindow'
import 'dockview-react/dist/styles/dockview.css'
import './dockview-theme.css'

/**
 * Assembles the studio: icon rails stuck to the edges, rounded tool windows laid over the
 * chassis gutter, Dockview in the center for documents only, and a status line at the foot.
 *
 * The center takes ONLY documents: an open file and its toolbar. Tool windows live on the
 * edges and never enter it.
 */
export function Shell() {
  const activeWorkspace = useLayouts(state => state.activeWorkspace)
  const setActiveWorkspace = useLayouts(state => state.setActiveWorkspace)
  const focus = useTools(state => state.focus)

  return (
    <div className="bg-chassis flex h-full flex-col">
      <TitleBar
        activeWorkspace={activeWorkspace}
        onWorkspace={setActiveWorkspace}
        actions={<AccountSelect />}
      />

      <div className="flex min-h-0 flex-1">
        <Rail side="left" />

        {/* Handles occupy exactly the gutter: the space between two surfaces IS the resize
            area, rather than decorative emptiness doubled by a handle. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col py-(--sc-gutter)">
          <Edge zone="top" />
          <div className="flex min-h-0 flex-1">
            <Edge zone="left" />
            <Panel className="min-w-0 flex-1" onPointerDownCapture={() => focus(null)}>
              <DocumentArea />
            </Panel>
            <Edge zone="right" />
          </div>
          <Edge zone="bottom" />
        </div>

        <Rail side="right" />
      </div>

      <Footer left={<Breadcrumb />} right={<JobsStatus />} />
      <TooltipHost />
    </div>
  )
}

/**
 * A zone's two halves and its resize handle, ordered by the zone. `left` and `top` put the
 * panels first; the opposite zones put the handle first, because they grow backwards.
 */
function Edge({ zone }: { zone: ToolZone }) {
  // Stable across the whole drag, so the memoized panels skip a size change entirely.
  const focusZone = useCallback(() => useTools.getState().focus(zone), [zone])
  const closePrimary = useCallback(() => useTools.getState().close(zone, 'primary'), [zone])
  const closeSecondary = useCallback(() => useTools.getState().close(zone, 'secondary'), [zone])

  const slots = useTools(state => state.open[zone])
  const size = useTools(state => state.sizes[zone] ?? DEFAULT_SIZES[zone])
  const split = useTools(state => state.splits[zone] ?? DEFAULT_SPLIT)
  const workspace = useLayouts(state => state.activeWorkspace)
  const hasModel = useHasModel(workspace)

  const shown = (slot: ToolSlot): ToolId | null =>
    shownTool(slots?.[slot] ?? null, zone, slot, workspace, hasModel)

  const primary = shown('primary')
  const secondary = shown('secondary')
  if (!primary && !secondary) return null

  // Actions are stable for the store's lifetime: subscribing to them would only add
  // selectors re-run on every write.
  const { resize, resplit } = useTools.getState()
  const lying = isHorizontal(zone)

  const panel = (
    <div
      // No gap: the handle between the two halves already occupies the gutter, exactly as the
      // zone handles do outside. Adding one here spaces them by three gutters.
      className={cn('flex min-h-0 min-w-0', lying ? 'flex-row' : 'flex-col')}
      style={{ [lying ? 'height' : 'width']: size }}
    >
      {primary && (
        <ToolWindow tool={primary} zone={zone} onFocus={focusZone} onClose={closePrimary} />
      )}

      {/* Only between two open halves: a lone panel has nothing to be dragged against. */}
      {primary && secondary && (
        <ResizeHandle
          axis={lying ? 'horizontal' : 'vertical'}
          invert
          size={split}
          onSize={(value, available) => resplit(zone, value, available)}
        />
      )}

      {secondary && (
        <ToolWindow
          tool={secondary}
          zone={zone}
          // The second half keeps a length of its own only while the first is there to take the
          // rest; alone, it fills the zone.
          length={primary ? split : undefined}
          onFocus={focusZone}
          onClose={closeSecondary}
        />
      )}
    </div>
  )
  const handle = (
    <ResizeHandle
      axis={lying ? 'vertical' : 'horizontal'}
      invert={!isLeading(zone)}
      size={size}
      onSize={(value, available) => resize(zone, value, available)}
    />
  )

  return isLeading(zone) ? (
    <>
      {panel}
      {handle}
    </>
  ) : (
    <>
      {handle}
      {panel}
    </>
  )
}
