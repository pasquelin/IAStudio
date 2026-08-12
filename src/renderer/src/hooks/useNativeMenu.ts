import { useEffect } from 'react'
import type { CommandId, MenuCheck } from '@shared/domain/command'
import { saveDocument, saveDocumentAs } from '@/app/document-io'
import { revealTool } from '@/helpers/reveal-panel'
import { availableToolIds } from '@/helpers/tool-registry'
import { getBridge } from '@/services/bridge'
import { publishCommand } from '@/services/command-bus'
import { reportFailure } from '@/services/diagnostics'
import { addNodeTo } from '@/hooks/useAddNode'
import { activeIdOfKind, useDocuments } from '@/stores/documents'
import { displayOfPane, sceneViewOf, useSceneViews } from '@/stores/scene-views'
import { sceneEngineOf } from '@/stores/scene-engines'
import { toolSurface, useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { useTools } from '@/stores/tools'

/** The global commands, which are the ones the native menu fires. The rest belong to a surface. */
function runCommand(command: CommandId): void {
  switch (command) {
    case 'layout.reset':
      useTools.getState().reset()
      return
    case 'project.new':
      void useProject.getState().createPicked()
      return
    case 'project.open':
      void useProject.getState().openPicked()
      return
    case 'document.save': {
      // The menu is application-wide and has no idea which tab is in front; the store does.
      const documentId = useDocuments.getState().activeId
      // The tab keeps its marker either way; the log is what says why it kept it.
      if (documentId) {
        void saveDocument(documentId).catch(error =>
          reportFailure('document.save', documentId, error),
        )
      }
      return
    }
    case 'document.saveAs': {
      const documentId = useDocuments.getState().activeId
      // The refusal is `saveDocumentAs`' to journal — a document that edits no asset has no copy
      // to make, and it says so under the shelf the copy would have landed in.
      if (documentId) {
        void saveDocumentAs(documentId).catch(error =>
          reportFailure('document.save', documentId, error),
        )
      }
      return
    }
    default:
      // Everything else belongs to a surface — the canvas, the scene, the timeline — and only
      // the document in front knows how to run it. Without this the whole Image menu fired into
      // nothing: eleven rows that looked live and did strictly nothing when clicked.
      publishCommand(command)
  }
}

/**
 * Which View rows are ticked, read off the scene in front.
 *
 * A row that toggles has to SAY whether it is on — a "Skeletons" row that reads the same either
 * way is half a control. The state lives here because it belongs to a document, and the main
 * process holds no document.
 *
 * Only the main pane's way of drawing is published: a quad layout gives each of its four views
 * one, and a menu has a single row to say it with. The bar has the same limit, for the same
 * reason — see `SceneDocument`.
 */
function sceneChecks(): MenuCheck[] {
  const documentId = activeIdOfKind(useDocuments.getState(), 'scene')
  if (!documentId) return []

  const view = sceneViewOf(useSceneViews.getState(), documentId)
  const checks: MenuCheck[] = [`scene.display:${displayOfPane(view.displays, 0)}`]

  if (view.projection === 'orthographic') checks.push('scene.projection')
  if (view.quad) checks.push('scene.quad')
  if (view.quadEdges) checks.push('scene.quadEdges')
  if (view.skeletons) checks.push('scene.skeletons')
  if (view.poseMode) checks.push('scene.poseMode')

  return checks
}

/**
 * What was last sent, so an identical context is not sent twice.
 *
 * The main process already drops a rebuild that changes nothing, and that was enough while this
 * was published on three stores nobody writes in a loop. `useSceneViews` is not one of those:
 * it carries the animation playhead, written on EVERY frame of a running animation. Compared
 * here, a played scene sends nothing; compared only on the other side, it would send sixty
 * messages a second for a menu that never changes.
 */
let published = ''

/** The ticks alone, so a frame of animation can be dismissed without pricing the rest. */
let publishedChecks = ''

/**
 * Tells the main process what the menu should offer. Published from here rather than from
 * `setActiveWorkspace`, because it depends on more than the section: choosing a model brings
 * the generator into existence, and the menu has to learn it at that moment.
 */
function publishMenuContext(): void {
  const workspace = useLayouts.getState().activeWorkspace
  // What the surface in front can open, not what the space behind it could: the home carries
  // the Explorer alone, and offering the other panels there would be menu entries that do
  // nothing visible.
  const tools = availableToolIds(toolSurface())
  const checked = sceneChecks()

  const signature = JSON.stringify([workspace, tools, checked])
  if (signature === published) return
  published = signature
  publishedChecks = checked.join('|')

  void getBridge()?.window.setWorkspace(workspace, tools, checked)
}

/**
 * The scene view store's own listener, and the reason it is not `publishMenuContext` itself.
 *
 * That store is written on every frame of a running animation, and the full context is not free
 * to build: `availableToolIds` walks the whole tool registry and the signature stringifies its
 * result. Reading the six values a tick comes from is, so the frames that change nothing — which
 * is all of them, the playhead being no part of a tick — are dismissed before that work happens.
 */
function publishIfChecksChanged(): void {
  const checks = sceneChecks().join('|')
  if (checks === publishedChecks) return
  publishMenuContext()
}

/**
 * Wires the native menu to the shell. Without this listener, "View ▸ Tool windows" would emit
 * into the void and the menu entries would silently do nothing.
 */
export function useNativeMenu(): void {
  // Subscribed once for the lifetime of the app: every listener below reads its store at call
  // time, so nothing here has to be torn down when a tab or a document changes.
  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

    // A window that has just mounted has announced nothing, whatever a previous mount of this
    // module sent. Without this the first publication after a remount would be skipped as a
    // duplicate, and the menu would sit on what the PREVIOUS window happened to leave behind.
    published = ''
    publishedChecks = ''
    // The persisted workspace is restored without going through `setActiveWorkspace`, so the
    // menu would sit on the default until the user switched spaces by hand.
    publishMenuContext()
    // The main process drops a rebuild that changes nothing, so publishing on every write of
    // these stores costs a comparison rather than a menu. `useDocuments` is among them because
    // which scene is in front decides what the ticks read.
    const stopPublishing = [useLayouts, useModels, useSettings, useDocuments].map(store =>
      store.subscribe(publishMenuContext),
    )
    // `useSceneViews` is subscribed apart, through the guard that prices a tick before a context.
    stopPublishing.push(useSceneViews.subscribe(publishIfChecksChanged))

    // Through `revealTool`, which resolves the zone: a tool sits in different ones depending on
    // the workspace, and the menu is built once for the whole app.
    const stopTool = bridge.menu.onOpenTool(({ tool }) => revealTool(tool))

    const stopCommand = bridge.menu.onCommand(runCommand)
    // The same path the toolbar and the panels take: two ways of adding a node would drift.
    const stopSceneAdd = bridge.menu.onSceneAdd(({ kind }) => {
      // Of the right kind: the menu is app-wide, and a node written under an image document
      // would give it a scene and a history it has no editor for.
      const documentId = activeIdOfKind(useDocuments.getState(), 'scene')
      if (documentId) addNodeTo(documentId, kind)
    })

    // The camera is the engine's, not the store's: a side to look from is a move, not a state
    // — see `PaneView`. The main pane alone, as the bar's own flyout does.
    const stopSceneView = bridge.menu.onSceneView(({ direction }) => {
      const documentId = activeIdOfKind(useDocuments.getState(), 'scene')
      if (documentId) sceneEngineOf(documentId)?.viewFrom(direction)
    })

    const stopSceneDisplay = bridge.menu.onSceneDisplay(({ mode }) => {
      const documentId = activeIdOfKind(useDocuments.getState(), 'scene')
      if (documentId) useSceneViews.getState().setDisplay(documentId, 0, mode)
    })

    return () => {
      stopTool()
      stopCommand()
      stopSceneAdd()
      stopSceneView()
      stopSceneDisplay()
      for (const stop of stopPublishing) stop()
    }
  }, [])
}
