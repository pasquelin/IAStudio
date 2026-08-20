import { useEffect } from 'react'
import { TooltipHost } from '@/design/TooltipHost'
import { useHomeVisible, useLayouts } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'
import { useTools } from '@/stores/tools'
import { HomeView } from '@/home/HomeView/HomeView'
import { DocumentArea } from '../DocumentArea'
import { AssetPicker } from '../AssetPicker/AssetPicker'
import { showWorkspace } from '../dockviewApi'
import { guardUnsavedWork } from '../unsavedGuard'
import { useAutosave } from '@/hooks/useAutosave'
import { useGitWatch } from '@/hooks/useGitWatch'
import { AssistantEntry } from '@/assistant/AssistantEntry'
import { AssistantOverlay } from '@/assistant/AssistantOverlay/AssistantOverlay'
import { AssistantStatus } from '@/assistant/AssistantStatus'
import { AssistantToast } from '@/assistant/AssistantToast'
import { DictationStatus } from '@/dictation/DictationStatus/DictationStatus'
import { Breadcrumb } from '../Breadcrumb'
import { Footer } from '../Footer'
import { ActivityStatus } from '../ActivityStatus'
import { ActivityToasts } from '../ActivityToasts'
import { TasksStatus } from '../TasksStatus'
import { JobsStatus } from '../JobsStatus'
import { UpdateStatus } from '../UpdateStatus'
import { Rail } from '../Rail/Rail'
import { Separator } from '@/design/Separator'
import { AccountSelect } from '../AccountSelect'
import { ProjectSelect } from '../ProjectSelect'
import { TitleBar } from '../TitleBar/TitleBar'
import { Panel } from '@/design/Panel'
import { isZoneShown, useShownTools } from '@/hooks/useShownTools'
import { ShellBand } from './ShellBand'
import { ShellEdge } from './ShellEdge'
import 'dockview-react/dist/styles/dockview.css'
import '../dockview-theme.css'

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
  const bottomLeft = isZoneShown(useShownTools('bottomLeft'))
  const bottomRight = isZoneShown(useShownTools('bottomRight'))

  // The window is the one that holds documents, so it is the one that must not go quietly.
  useEffect(() => guardUnsavedWork(window), [])
  useAutosave()

  // Here rather than in the two panels that draw it: whether git holds the folder decides whether
  // the band offers the history at all, so the answer has to exist while both are closed. The
  // WATCH and not `useGitStatus` — the root subscribed to the status redraws the whole window
  // every time a file the studio itself wrote changed it.
  useGitWatch()

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
          <ShellEdge zone="top" />

          {/* A column runs to the FOOT of the frame unless the band's half on its side is
              drawing: the strip then starts where that column ends, and the opposite one keeps
              its full height. The centre stays at the same place in the tree through all four
              arrangements — moved, it would tear down Dockview and every engine under it. */}
          <div className="flex min-h-0 flex-1">
            {!bottomLeft && <ShellEdge zone="left" />}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1">
                {bottomLeft && <ShellEdge zone="left" />}
                <Panel className="min-w-0 flex-1" onPointerDownCapture={() => focus(null)}>
                  {home ? <HomeView /> : <DocumentArea />}
                </Panel>
                {bottomRight && <ShellEdge zone="right" />}
              </div>

              <ShellBand left={bottomLeft} right={bottomRight} />
            </div>

            {!bottomRight && <ShellEdge zone="right" />}
          </div>
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
            {/* After the generations: both are work in flight, and what the studio is writing
                out is nearer to being finished than what it is still asking the API for. */}
            <TasksStatus />
            <ActivityStatus />
          </>
        }
      />
      <ActivityToasts />
      <AssistantToast />
      {/* Over everything, and mounted whether or not it shows: it is the window's confirmer, and
          an action that needs a yes must be able to raise one from a closed modal. */}
      <AssistantOverlay />
      {/* The window a slot browses the whole project from. Mounted here rather than by the
          inspector: a panel that happened to be closed would leave the browse button with
          nobody to ask. */}
      <AssetPicker />
      <TooltipHost />
    </div>
  )
}
