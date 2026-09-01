import { useEffect } from 'react'
import type { MenuAbility, MenuCheck } from '@shared/domain/command'
import { revealTool } from '@/helpers/revealPanel'
import { availableToolIds } from '@/helpers/toolRegistry'
import { getBridge } from '@/services/bridge'
import { routeCommand } from '@/services/commandRouter'
import { addNodeTo } from '@/hooks/useAddNode'
import { canMaskFromSelection, canMergeDown } from '@/engines/canvas/canvasState'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { selectionOf, useCanvasViews } from '@/stores/canvasViews'
import { activeIdOfKind, useDocuments } from '@/stores/documents'
import { displayOfPane, MAIN_SCENE_PANE, sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useGit } from '@/stores/git'
import { toolSurface, useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'

type SceneMenuState = { checked: MenuCheck[]; abilities: MenuAbility[] }

/**
 * What the scene in front tells the menu: which View rows are ticked, and which rows can answer
 * at all. Both in one read, the id being resolved once — this is priced on every write of two
 * stores, one of which a timeline drag writes on every frame of the pointer.
 *
 * Only the main pane's way of drawing is published: a quad layout gives each of its four views
 * one, and a menu has a single row to say it with — the bar has the same limit, see `SceneDocument`.
 */
function sceneMenuState(): SceneMenuState {
  const documentId = activeIdOfKind(useDocuments.getState(), 'scene')
  if (!documentId) return { checked: [], abilities: [] }

  const view = sceneViewOf(useSceneViews.getState(), documentId)
  const checked: MenuCheck[] = [`scene.display:${displayOfPane(view.displays, MAIN_SCENE_PANE)}`]

  if (view.projection === 'orthographic') checked.push('scene.projection')
  if (view.quad) checked.push('scene.quad')
  if (view.quadEdges) checked.push('scene.quadEdges')
  if (view.skeletons) checked.push('scene.skeletons')
  if (view.poseMode) checked.push('scene.poseMode')

  // The scene is where its own selection lives, and the only place it ever did: the global
  // selection carried a copy that nothing read and that any other panel could wipe.
  const picked = sceneOf(useScenes.getState(), documentId).selectedIds.length > 0

  return { checked, abilities: picked ? ['scene.exportSelection'] : [] }
}

/**
 * The image document's half: the two Image rows that refuse in silence when the stack cannot
 * answer them.
 *
 * Through the two exported predicates rather than by re-deriving them, exactly as
 * `canRemoveLayer` is read from both sides: the handler that RUNS the gesture reads the same
 * answer, so a row can never be offered for something the handler will decline. Spelt again here,
 * the mask row was enabled with a selection and no active layer — and clicking it did nothing.
 */
function canvasAbilities(): MenuAbility[] {
  const documentId = activeIdOfKind(useDocuments.getState(), 'image')
  if (!documentId) return []

  const stack = canvasOf(useCanvases.getState(), documentId)
  const selected = selectionOf(useCanvasViews.getState(), documentId) !== null
  const abilities: MenuAbility[] = []

  if (canMaskFromSelection(stack, selected)) abilities.push('canvas.maskFromSelection')
  if (canMergeDown(stack)) abilities.push('canvas.mergeDown')

  return abilities
}

/**
 * What was last sent, so an identical context is not sent twice.
 *
 * The main process already drops a rebuild that changes nothing, and that was enough while this
 * was published on three stores nobody writes in a loop. `useSceneViews` and `useScenes` are not
 * among those: compared here, a played animation sends nothing; compared only on the other side,
 * it would send sixty messages a second for a menu that never changes.
 */
let published = ''

/** The scene's half of it, so the writes that change no row are dismissed without pricing the rest. */
let publishedScene = ''

/** The git half, for the same reason: `busy` flips twice a command and moves no row. */
let publishedGitKind = ''

/**
 * The image half, and it belongs to that same family: dragging a layer rewrites `useCanvases`
 * on every pointer move, and none of those frames moves a row.
 */
let publishedCanvas = ''

function sceneSignature(state: SceneMenuState): string {
  return `${state.checked.join('|')}/${state.abilities.join('|')}`
}

/**
 * Tells the main process what the menu should offer. Published from here rather than from
 * `setActiveWorkspace`, because it depends on more than the section: choosing a model brings
 * the generator into existence, and the menu has to learn it at that moment.
 */
function publishMenuContext(): void {
  // The surface in front, not the space behind it: the home carries the Explorer alone, and a
  // menu built on the space it covers offered the whole image toolbox over a screen that edits
  // no image — along with every other row only a document can answer.
  const surface = toolSurface()
  const tools = availableToolIds(surface)
  const scene = sceneMenuState()
  const canvas = canvasAbilities()
  const abilities = [...scene.abilities, ...canvas]

  const front = useDocuments.getState()
  const kind = (front.activeId ? front.documents[front.activeId] : undefined)?.kind ?? null

  const signature = JSON.stringify([surface, tools, scene.checked, abilities, kind])
  if (signature === published) return
  published = signature
  publishedScene = sceneSignature(scene)
  publishedCanvas = canvas.join('|')

  void getBridge()?.window.setWorkspace(surface, tools, scene.checked, abilities, kind)
}

/** The listener of the two image stores — a layer drag writes one on every pointer move. */
function publishIfCanvasChanged(): void {
  if (canvasAbilities().join('|') === publishedCanvas) return
  publishMenuContext()
}

/**
 * The listener of the two scene stores, and the reason it is not `publishMenuContext` itself.
 *
 * Both are written far more often than the menu changes — the playhead on every frame of a
 * running animation, the scene on every pointer move of a timeline drag — while the full context
 * is not free to build: `availableToolIds` walks the whole tool registry. `sceneMenuState` is,
 * so the writes that move no row are dismissed before that work happens.
 */
function publishIfSceneChanged(): void {
  if (sceneSignature(sceneMenuState()) === publishedScene) return
  publishMenuContext()
}

/**
 * The same guard for git: only which state the repository is IN can add or remove a row.
 *
 * The kind is recorded HERE rather than in `publishMenuContext`, which returns early when the
 * context has not moved: two kinds that offer the same panels would leave it on the first of
 * them, and every `busy` flip after that would pay a full registry walk to find that out.
 */
function publishIfGitChanged(): void {
  const { kind } = useGit.getState().repository
  if (kind === publishedGitKind) return
  publishedGitKind = kind
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
    publishedScene = ''
    publishedGitKind = ''
    publishedCanvas = ''
    // The persisted workspace is restored without going through `setActiveWorkspace`, so the
    // menu would sit on the default until the user switched spaces by hand.
    publishMenuContext()
    // The main process drops a rebuild that changes nothing, so publishing on every write of
    // these stores costs a comparison rather than a menu. `useDocuments` is among them because
    // which scene is in front decides what the ticks read.
    // `useProject` is among them because the home offers the Explorer only while a project is
    // open: without it the row would stay in the menu until something else happened to publish.
    const stopPublishing = [useLayouts, useSettings, useDocuments, useProject].map(store =>
      store.subscribe(publishMenuContext),
    )
    // Search keystrokes used to rebuild the native menu: only the chosen model moves a row.
    stopPublishing.push(
      useModels.subscribe((state, previous) => {
        if (state.selected === previous.selected) return
        publishMenuContext()
      }),
    )
    // The two written far too often are subscribed apart, through the guard that prices a tick
    // and an ability before a context. `useScenes` is one of them because what is PICKED in a
    // scene decides whether the menu offers to export a selection.
    for (const store of [useSceneViews, useScenes])
      stopPublishing.push(store.subscribe(publishIfSceneChanged))
    // The image stores belong to that second family too: a layer drag writes `useCanvases` on
    // every pointer move, and what the two Image rows need from it changes far more rarely.
    for (const store of [useCanvases, useCanvasViews])
      stopPublishing.push(store.subscribe(publishIfCanvasChanged))
    // `useGit` belongs to that second family rather than the first: the history is offered only
    // over a folder under version control, but `busy` flips on every command and moves no row.
    stopPublishing.push(useGit.subscribe(publishIfGitChanged))

    // Through `revealTool`, which resolves the zone: a tool sits in different ones depending on
    // the workspace, and the menu is built once for the whole app.
    const stopTool = bridge.menu.onOpenTool(({ tool }) => revealTool(tool))

    // The verdict is dropped on purpose: a menu row that reaches nothing is a row already greyed
    // out, and there is nobody to answer. An MCP client is the caller that needs it.
    const stopCommand = bridge.menu.onCommand(command => void routeCommand(command))
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
      if (documentId) useSceneViews.getState().setDisplay(documentId, MAIN_SCENE_PANE, mode)
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
