import { TooltipHost } from '@/design/TooltipHost'
import { useLayouts } from '@/stores/layouts'
import { DEFAULT_SIZES, useTools } from '@/stores/tools'
import { DocumentArea } from './DocumentArea'
import { Footer } from './Footer'
import { Rail } from './Rail'
import { ResizeHandle } from './ResizeHandle'
import { TitleBar } from './TitleBar'
import { isLeading, type ToolZone } from './tools'
import { Panel, ToolWindow } from './ToolWindow'
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
      <TitleBar activeWorkspace={activeWorkspace} onWorkspace={setActiveWorkspace} />

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

      <Footer />
      <TooltipHost />
    </div>
  )
}

/**
 * A tool window and its resize handle, ordered by the zone. `left` and `top` put the panel
 * first; the opposite zones put the handle first, because they grow backwards.
 */
function Edge({ zone }: { zone: ToolZone }) {
  const tool = useTools(state => state.open[zone] ?? null)
  const size = useTools(state => state.sizes[zone] ?? DEFAULT_SIZES[zone])

  if (!tool) return null

  // Actions are stable for the store's lifetime: subscribing to them would only add
  // selectors re-run on every write.
  const { close, focus, resize } = useTools.getState()

  const panel = (
    <ToolWindow
      zone={zone}
      tool={tool}
      size={size}
      onFocus={() => focus(zone)}
      onClose={() => close(zone)}
    />
  )
  const handle = (
    <ResizeHandle
      zone={zone}
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
