import { useCallback, useEffect } from 'react'
import { cn } from '@/helpers/cn'
import { TooltipHost } from '@/design/TooltipHost'
import { useHomeVisible, useLayouts, useToolSurface } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'
import { arrangementOf, DEFAULT_SIZES, DEFAULT_SPLIT, useTools } from '@/stores/tools'
import { HomeView } from '@/home/HomeView'
import { DocumentArea } from './DocumentArea'
import { showWorkspace } from './dockview-api'
import { guardUnsavedWork } from './unsaved-guard'
import { AssistantEntry } from '@/assistant/AssistantEntry'
import { AssistantOverlay } from '@/assistant/AssistantOverlay'
import { AssistantStatus } from '@/assistant/AssistantStatus'
import { AssistantToast } from '@/assistant/AssistantToast'
import { DictationStatus } from '@/dictation/DictationStatus'
import { Breadcrumb } from './Breadcrumb'
import { Footer } from './Footer'
import { ActivityStatus } from './ActivityStatus'
import { ActivityToasts } from './ActivityToasts'
import { JobsStatus } from './JobsStatus'
import { UpdateStatus } from './UpdateStatus'
import { Rail } from './Rail'
import { ResizeHandle } from '@/design/ResizeHandle'
import { Separator } from '@/design/Separator'
import { AccountSelect } from './AccountSelect'
import { ProjectSelect } from './ProjectSelect'
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
  const setHome = useLayouts(state => state.setHome)
  const focus = useTools(state => state.focus)

  // The window is the one that holds documents, so it is the one that must not go quietly.
  useEffect(() => guardUnsavedWork(window), [])

  const homeEnabled = useSettings(state => state.settings.home.enabled)
  // The setting wins over the session: turning the home off must take it off the screen it is
  // currently on, not at the next launch.
  const home = useHomeVisible()

  return (
    <div className="bg-chassis flex h-full flex-col">
      <TitleBar
        activeWorkspace={activeWorkspace}
        // `showWorkspace` and not the store's setter: choosing a section also brings its last
        // tab forward, now that the centre holds every section's tabs at once.
        onWorkspace={showWorkspace}
        home={home}
        onHome={homeEnabled ? () => setHome(true) : undefined}
        // Local then remote: the folder everything is written into, then the key it is
        // generated on. The pair is the studio's "where am I" in one corner.
        // The two ways to reach the assistant, then the pair that says where one is. Parted by a
        // hairline because they are not the same kind of thing: one acts, the other points.
        actions={
          <>
            <AssistantEntry />
            <Separator orientation="vertical" />
            <ProjectSelect />
            <AccountSelect />
          </>
        }
      />

      {/* One frame for both surfaces, and now the same shape on each: two columns of panels
          around a centre. The zones a surface does not have take themselves off on their own —
          no placement serves them there, so the home's bands render nothing without being told.
          It swaps the centre for the page; no Dockview, which takes documents only. */}
      <div className="flex min-h-0 flex-1">
        <Rail side="left" />

        {/* Handles occupy exactly the gutter: the space between two surfaces IS the resize
            area, rather than decorative emptiness doubled by a handle. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col py-(--sc-gutter)">
          <Edge zone="top" />
          <div className="flex min-h-0 flex-1">
            <Edge zone="left" />
            <Panel className="min-w-0 flex-1" onPointerDownCapture={() => focus(null)}>
              {home ? <HomeView /> : <DocumentArea />}
            </Panel>
            <Edge zone="right" />
          </div>
          <Edge zone="bottom" />
        </div>

        <Rail side="right" />
      </div>

      <Footer
        left={<Breadcrumb />}
        right={
          <>
            {/* First of the indicators: a live microphone outranks a download. The assistant
                follows it, because the two are read as one sentence — what is being heard, then
                what became of it. */}
            <DictationStatus />
            <AssistantStatus />
            <UpdateStatus />
            <JobsStatus />
            <ActivityStatus />
          </>
        }
      />
      <ActivityToasts />
      <AssistantToast />
      {/* Over everything, and mounted whether or not it shows: it is the window's confirmer, and
          an action that needs a yes must be able to raise one from a closed modal. */}
      <AssistantOverlay />
      <TooltipHost />
    </div>
  )
}

/**
 * A zone's two halves and its resize handle, ordered by the zone. `left` and `top` put the
 * panels first; the opposite zones put the handle first, because they grow backwards.
 */
function Edge({ zone }: { zone: ToolZone }) {
  const surface = useToolSurface()

  // Stable across the whole drag, so the memoized panels skip a size change entirely.
  const focusZone = useCallback(() => useTools.getState().focus(zone), [zone])
  const closePrimary = useCallback(
    () => useTools.getState().close(surface, zone, 'primary'),
    [surface, zone],
  )
  const closeSecondary = useCallback(
    () => useTools.getState().close(surface, zone, 'secondary'),
    [surface, zone],
  )

  const slots = useTools(state => arrangementOf(state, surface).open[zone])
  const size = useTools(state => arrangementOf(state, surface).sizes[zone] ?? DEFAULT_SIZES[zone])
  const split = useTools(state => arrangementOf(state, surface).splits[zone] ?? DEFAULT_SPLIT)
  const hasModel = useHasModel(surface)

  // The stored value straight through: `undefined` is a closed half and `null` an unchosen one,
  // and collapsing the two would close every half nobody has clicked.
  const shown = (slot: ToolSlot): ToolId | null =>
    shownTool(slots?.[slot], zone, slot, surface, hasModel)

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
          onSize={(value, available) => resplit(surface, zone, value, available)}
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
      onSize={(value, available) => resize(surface, zone, value, available)}
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
