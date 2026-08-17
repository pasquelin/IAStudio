import { useEffect } from 'react'
import { TooltipHost } from '@/design/TooltipHost'
import { useHomeVisible, useLayouts } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'
import { useTools } from '@/stores/tools'
import { HomeView } from '@/home/HomeView/HomeView'
import { DocumentArea } from '../DocumentArea'
import { DocumentNameDialog } from '../DocumentNameDialog'
import { showWorkspace } from '../dockview-api'
import { guardUnsavedWork } from '../unsaved-guard'
import { useAutosave } from '@/hooks/useAutosave'
import { AssistantEntry } from '@/assistant/AssistantEntry'
import { AssistantOverlay } from '@/assistant/AssistantOverlay/AssistantOverlay'
import { AssistantStatus } from '@/assistant/AssistantStatus'
import { AssistantToast } from '@/assistant/AssistantToast'
import { DictationStatus } from '@/dictation/DictationStatus/DictationStatus'
import { Breadcrumb } from '../Breadcrumb'
import { Footer } from '../Footer'
import { ActivityStatus } from '../ActivityStatus'
import { ActivityToasts } from '../ActivityToasts'
import { JobsStatus } from '../JobsStatus'
import { UpdateStatus } from '../UpdateStatus'
import { Rail } from '../Rail/Rail'
import { Separator } from '@/design/Separator'
import { AccountSelect } from '../AccountSelect'
import { ProjectSelect } from '../ProjectSelect'
import { TitleBar } from '../TitleBar/TitleBar'
import { Panel } from '@/design/Panel'
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

  // The window is the one that holds documents, so it is the one that must not go quietly.
  useEffect(() => guardUnsavedWork(window), [])
  useAutosave()

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
          <div className="flex min-h-0 flex-1">
            <ShellEdge zone="left" />
            <Panel className="min-w-0 flex-1" onPointerDownCapture={() => focus(null)}>
              {home ? <HomeView /> : <DocumentArea />}
            </Panel>
            <ShellEdge zone="right" />
          </div>
          <ShellEdge zone="bottom" />
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
      {/* After the assistant, and over it: a sentence said to it can ask for a document, and the
          field that names one would otherwise open behind the conversation that asked for it. */}
      <DocumentNameDialog />
      <TooltipHost />
    </div>
  )
}
