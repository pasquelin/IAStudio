import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel, Panels } from '@pasquelin/panels'
import '@pasquelin/panels/styles.css'
import { TooltipHost } from '@/components/TooltipHost'
import { useHomeVisible, useLayouts, useToolSurface } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'
import { HomeView } from '@/features/home/components/HomeView/HomeView'
import { DocumentArea } from '../Document/DocumentArea'
import { AssetPicker } from '../AssetPicker/AssetPicker'
import { showWorkspace } from '../dockviewApi'
import { guardUnsavedWork } from '../../unsavedGuard'
import { useAutosave } from '@/hooks/useAutosave'
import { useGitWatch } from '@/hooks/useGitWatch'
import { holdConfirmer } from '@/features/assistant/holdConfirmer'
import { AssistantStatus } from '@/features/assistant/components/Assistant/AssistantStatus'
import { AssistantToast } from '@/features/assistant/components/Assistant/Toast/AssistantToast'
import { DictationStatus } from '@/features/dictation/components/Dictation/Status/DictationStatus'
import { Breadcrumb } from '../Breadcrumb'
import { Footer } from '../Footer'
import { ActivityStatus } from '../Activity/ActivityStatus'
import { ActivityToasts } from '../Activity/ActivityToasts'
import { TasksStatus } from '../TasksStatus'
import { JobsStatus } from '../JobsStatus'
import { UpdateStatus } from '../UpdateStatus'
import { RailNewButton } from '../RailNewButton'
import { AccountSelect } from '../AccountSelect'
import { ProjectSelect } from '../ProjectSelect'
import { TitleBar } from '../TitleBar/TitleBar'
import { UiIcon } from '@/components/UiIcon'
import { fillsActions, hasActions } from '../toolComponents'
import { toolIcon, toolTitleKey } from '@/helpers/toolRegistry'
import { panelSpecsOf } from '../../panelSpecs'
import { useToolState } from '@/hooks/useToolState'
import { familyOf } from '@shared/domain/tool'
import { panelsStore } from '@/stores/panels'
import { ShellPanelActions } from './ShellPanelActions'
import { ShellPanelBody } from './ShellPanelBody'
import { ShellPanelButton } from './ShellPanelButton'
import 'dockview-react/dist/styles/dockview.css'
import '../dockview-theme.css'

/** Read once by the chassis, so the buttons it draws never change identity. */
const COMPONENTS = { IconButton: ShellPanelButton }

/** Stable for the store's lifetime: a new identity here would re-render the whole centre. */
const dropFocus = (): void => panelsStore.getState().focus(null)

/**
 * Assembles the studio: `@pasquelin/panels` draws the frame — icon rails on the edges, rounded
 * panels over the gutter, five resizable zones — and the studio says WHAT hangs where.
 *
 * The centre takes ONLY documents: an open file and its toolbar. Tool windows live on the edges
 * and never enter it.
 *
 * A panel the surface cannot offer is a panel NOT DECLARED, which is the whole of what used to
 * be `shownTools` and `openEverywhereItSits`: the half it held falls back to what this surface
 * does declare, and takes it back when the panel returns.
 */
export function Shell() {
  const { t } = useTranslation()
  const activeWorkspace = useLayouts(state => state.activeWorkspace)
  const setHome = useLayouts(state => state.setHome)

  // The window is the one that holds documents, so it is the one that must not go quietly.
  useEffect(() => guardUnsavedWork(window), [])

  // The window's confirmer: it outlives either host of the conversation, and brings one up.
  useEffect(holdConfirmer, [])
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

  const surface = useToolSurface()
  const state = useToolState()
  // The SAME mapping the bench declares from, so a headless run and the window can never
  // disagree about which panels a surface offers, nor about what they are called.
  const specs = useMemo(
    () => panelSpecsOf(surface, state, id => t(toolTitleKey(id))),
    [surface, state, t],
  )

  return (
    <Panels
      store={panelsStore}
      // The FAMILY, not the surface: the six spaces share one arrangement — a shelf opened in
      // Image is still there in Video — and the home shares with none, its left column holding
      // the projects where a space holds generation.
      view={familyOf(surface)}
      components={COMPONENTS}
      // 🛑 NOTHING persists the arrangement in this batch, deliberately: the studio's own key
      // carries twenty migrations the chassis' file knows nothing about, and reading it is the
      // next batch's whole subject. Left to the library, the first launch would overwrite it.
      storage={null}
      railHeader={<RailNewButton />}
      labels={{
        closePanel: t('actions.removeTool'),
        resizeZone: t('actions.resizeZone'),
        resizeSplit: t('actions.resizeSplit'),
        resizeBand: t('actions.resizeBand'),
      }}
      className="min-h-0 flex-1"
      header={
        <TitleBar
          activeWorkspace={activeWorkspace}
          // `showWorkspace` and not the store's setter: choosing a section also brings its last
          // tab forward, now that the centre holds every section's tabs at once.
          onWorkspace={showWorkspace}
          home={home}
          onHome={homeEnabled ? () => setHome(true) : undefined}
          // Local then remote: the folder everything is written into, then the key it is
          // generated on. The pair is the studio's "where am I" in one corner.
          actions={
            <>
              <ProjectSelect />
              <AccountSelect />
            </>
          }
        />
      }
      footer={
        <Footer
          left={<Breadcrumb />}
          right={
            <>
              {/* First of the indicators: a live microphone outranks a download. The assistant
                  follows it, because the two are read as one sentence — what is being heard,
                  then what became of it. */}
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
      }
    >
      {specs.map(spec => (
        <Panel
          key={spec.id}
          {...spec}
          icon={<UiIcon path={toolIcon(spec.id)} size={22} />}
          // 🛑 `undefined` for a panel that publishes none, never an element that renders null:
          // the chassis reads the PRESENCE of this prop to draw the header's separator and to
          // give the row's free width to the actions. Always passed, every panel wore a divider
          // in front of its close button, and every band panel took the width the montage asks
          // for.
          actions={hasActions(spec.id) ? <ShellPanelActions tool={spec.id} /> : undefined}
          fillActions={fillsActions(spec.id)}
        >
          <ShellPanelBody tool={spec.id} />
        </Panel>
      ))}

      <Panels.Center>
        {/* The centre takes the accent OFF the rail: an icon left lit while the reader is back
            in the document says a column has the focus when the canvas does. */}
        <div className="size-full" onPointerDownCapture={dropFocus}>
          {home ? <HomeView /> : <DocumentArea />}
        </div>
      </Panels.Center>

      <ActivityToasts />
      <AssistantToast />
      {/* The window a slot browses the whole project from. Mounted here rather than by the
          inspector: a panel that happened to be closed would leave the browse button with
          nobody to ask. */}
      <AssetPicker />
      <TooltipHost />
    </Panels>
  )
}
