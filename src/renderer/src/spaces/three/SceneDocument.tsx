import type { AssetType } from '@shared/domain/asset'
import { bindingOf, type CommandId } from '@shared/domain/command'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import type { ExportFormat, PathDescriptor, Vector3 as PlainVector3 } from '@shared/domain/scene'
import { withMovedPoint, withPointAfter, withPointAppended } from '@/engines/scene/cameraPath'
import { setPath, setTransform } from '@/engines/scene/commands'
import i18next from 'i18next'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PANE_TOOLBAR } from '@/design/styles'
import { Toolbar } from '@/design/Toolbar/Toolbar'
import { nodeById } from '@/engines/scene/sceneState'
import { movesToCommand } from '@/engines/scene/animationCommands'
import { sceneKeyingAt } from '@/helpers/sceneKeyingAt'
import { SceneRenderer, type TransformMode } from '@/engines/scene/SceneRenderer'
import { addNodeTo } from '@/hooks/useAddNode'
import { useAnimationPlayback } from '@/hooks/useAnimationPlayback'
import { useCheckerTextures } from '@/hooks/useCheckerTextures'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useExportMenu } from '@/hooks/useExportMenu'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useDocumentIsInFront } from '@/stores/documents'
import { captureSceneView } from '@/helpers/captureSceneView'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useSettings } from '@/stores/settings'
import { useBindingOverrides } from '@/stores/bindings'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { assetVersionOf } from '@/stores/assets'
import { useShelfRefresh } from '@/hooks/useShelfRefresh'
import type { NodeMove, SceneNode } from '@/engines/scene/sceneState'
import { useModelClips } from '@/stores/modelClips'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { DEFAULT_CAPTURE_QUALITY } from '@shared/domain/sceneCapture'
import { useSceneClipboard } from '@/stores/sceneClipboard'
import { addModelTo, isSceneDirty, sceneOf, selectIn, useScenes } from '@/stores/scenes'
import { displayOfPane, useSceneViews, sceneViewOf } from '@/stores/sceneViews'
import { skeletonProfilesOf, useSkeletonProfiles } from '@/stores/skeletonProfiles'
import { useProject } from '@/stores/project'
import { nextDisplayMode } from '@/engines/scene/sceneView'
import { isDisplayMode } from '@shared/domain/scene'
import { EMPTY_STATS, type SceneStats } from '@/engines/scene/sceneStats'
import { CameraPreview } from './CameraPreview/CameraPreview'
import { SceneCounters } from './SceneCounters'
import { openSceneAddMenu } from './sceneAddMenu'
import { openSceneNodeMenu } from './sceneNodeMenu'
import { openPathPointMenu } from './pathPointMenu'
import { removePickedPathPoint, runSceneCommand, toggleNodeVisible } from './sceneCommands'
import { ScenePaneGrid } from './ScenePaneGrid/ScenePaneGrid'
import { ADD_TOOLS, SCENE_TOOLS, addedKind } from './sceneTools'
import { sceneExportFiles } from './sceneExportFiles'
import { hideIn, isolating, NOTHING_ISOLATED, type Isolation } from '@/engines/scene/isolation'
import { toggledIsolation } from '@/engines/scene/sceneVisibility'

/**
 * Encoded here, written by the main process: the renderer has no `fs`, and where the file lands
 * is decided by the save dialog it never sees the answer of — only the name it was given.
 *
 * The encoding is inside the guard, not only the write: nothing awaits this call, so an exporter
 * that refuses a texture would otherwise reject into no one's hands and leave a menu click
 * looking exactly like a dismissed dialog.
 */
async function exportScene(
  documentId: string,
  format: ExportFormat,
  scope: 'scene' | 'selection',
): Promise<void> {
  const bridge = getBridge()
  if (!bridge) return

  try {
    // The encoding is `sceneExportFiles`, which the outside door shares. It reads the engine off
    // `sceneEngineOf` rather than taking one, which is what lets a client with only an id ask.
    const { folder, files } = await sceneExportFiles(documentId, format, scope)
    const encoded = files[0]
    if (encoded) await bridge.scene.export({ name: folder, format, data: encoded.bytes })
  } catch (error) {
    reportFailure('scene.export', format, error)
  }
}

/** What one of the three visibility gestures does, given the scene and what is already hidden. */
type IsolationEdit = (
  held: Isolation,
  nodes: readonly SceneNode[],
  ids: readonly string[],
) => Isolation

/** Read at call time so nothing closes over a scene — see the `useCallback` that dispatches. */
function changeIsolation(documentId: string, edit: IsolationEdit): void {
  const scene = sceneOf(useScenes.getState(), documentId)
  const held = sceneViewOf(useSceneViews.getState(), documentId).isolation

  useSceneViews.getState().setSceneIsolation(documentId, edit(held, scene.nodes, scene.selectedIds))
}

/** The rule itself is `movesToCommand`, which is pure and therefore testable — a viewport is not. */
function recordTransform(documentId: string, moves: readonly NodeMove[]): void {
  const { state, at, recording } = sceneKeyingAt(documentId)

  const command = movesToCommand(state, moves, at, recording)
  if (command) useScenes.getState().runCommand(documentId, command)
}

/**
 * A rail rewritten by the edit it is handed, and nothing written for a node that is not one.
 *
 * Once per gesture, like every other gizmo move: the engine reports on release, so a whole drag
 * costs one entry in the history without a gesture having to be opened around it.
 */
function editPath(
  documentId: string,
  nodeId: string,
  edit: (path: PathDescriptor) => PathDescriptor,
): void {
  const store = useScenes.getState()
  const node = nodeById(sceneOf(store, documentId), nodeId)
  if (node?.type !== 'path') return

  store.runCommand(documentId, setPath(nodeId, edit(node.path)))
}

/**
 * A control point posed in the stretch that was clicked, and picked on the way: the gizmo lands
 * on it straight away, so the point one just made is the point one drags.
 */
function addPathPoint(documentId: string, nodeId: string, index: number): void {
  editPath(documentId, nodeId, path => withPointAfter(path, index))
  useSceneViews.getState().setPickedPathPoint(documentId, { nodeId, index: index + 1 })
}

/**
 * A control point posed at the end of a rail, where the pointer aimed. The new END is picked, so
 * a run of clicks lays a trajectory and the gizmo sits on the last one laid.
 */
function appendPathPoint(documentId: string, nodeId: string, point: PlainVector3): void {
  const node = nodeById(sceneOf(useScenes.getState(), documentId), nodeId)
  if (node?.type !== 'path') return

  // Where the point WILL land, read before the edit: appending puts it at the length the rail
  // holds now. Read after, it would rest on `runCommand` having already applied.
  const index = node.path.points.length
  editPath(documentId, nodeId, path => withPointAppended(path, point))
  useSceneViews.getState().setPickedPathPoint(documentId, { nodeId, index })
}

/**
 * A node right-clicked in the viewport, selected and then offered what can be done to it.
 *
 * Selecting first is this side's job rather than the menu's, as it is for the asset shelf: an
 * outliner arms its row on pointer down, but the right button of a viewport flies the camera, so
 * nothing has armed anything by the time the menu is asked for. Left as it was when the node is
 * already in the selection — a right-click on one of six must not shrink it to one.
 *
 * No rename row: a viewport draws no name to type over. `i18next.t` rather than the hook's, for
 * the reason `documentIo` reads it that way — this runs from an engine callback, outside any
 * render, and the singleton is always the language in force.
 */
function openNodeMenu(documentId: string, nodeId: string | null): void {
  // The void offers what a scene can RECEIVE, where a node offers what can be done to it —
  // the same rows ⇧A opens, since it is the same question asked from the same place.
  if (nodeId === null) {
    return openSceneAddMenu({ t: i18next.t, onAdd: kind => addNodeTo(documentId, kind) })
  }

  const scene = sceneOf(useScenes.getState(), documentId)
  // Read before anything is selected: an id the engine still holds for a node the document has
  // already dropped would otherwise move the selection and then open no menu at all.
  const node = nodeById(scene, nodeId)
  if (!node) return

  if (!scene.selectedIds.includes(nodeId)) selectIn(documentId, [nodeId])

  openSceneNodeMenu({
    node,
    canFrame: true,
    t: i18next.t,
    run: command => runSceneCommand(documentId, command),
    onToggleVisible: () => toggleNodeVisible(documentId, node.id),
  })
}

const MESHES: readonly AssetType[] = ['mesh']

export function SceneDocument({ documentId }: { documentId: string }) {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<SceneRenderer | null>(null)
  const [mode, setMode] = useState<TransformMode>('select')
  const [localFrame, setLocalFrame] = useState(false)
  /** What the scene costs, as the engine counts it — see `SceneRendererOptions.onStats`. */
  const [stats, setStats] = useState<{ scene: SceneStats; selected: SceneStats }>({
    scene: EMPTY_STATS,
    selected: EMPTY_STATS,
  })

  const scene = useScenes(state => sceneOf(state, documentId))
  const modified = useScenes(state => isSceneDirty(state, documentId))
  const bindings = useBindingOverrides()
  const label = useShortcutLabel()
  const active = useDocumentIsInFront(documentId)
  const viewport = useSettings(state => state.settings.three)
  const view = useSceneViews(state => sceneViewOf(state, documentId))

  // Before the renderer mounts: a saved document comes back from the project, a new one from
  // the default scene — an unlit viewport reads as broken rather than as empty.
  useRestoredDocument(documentId)

  useDocumentTitle(documentId, modified)

  useEffect(() => {
    const element = host.current
    if (!element) return

    // Read at mount rather than subscribed to: a project cannot change under an open document,
    // and a subscription here would tear the viewport down to answer a rename.
    const projectPath = useProject.getState().project?.path ?? null

    const renderer = new SceneRenderer({
      // A click in the void with a modifier held keeps the selection: `toggle` of nothing is
      // nothing, which is what stops a near miss from undoing the picking that came before it.
      onSelect: (ids, mode) => selectIn(documentId, ids, mode),
      onTransform: moves => recordTransform(documentId, moves),
      onClips: (nodeId, clips, lengths) =>
        useModelClips.getState().report(documentId, nodeId, clips, lengths),
      onRig: (nodeId, rig) => useModelClips.getState().reportRig(documentId, nodeId, rig),
      // The project's, not the document's: the same character opens in the next document of this
      // project, and a mapping worked out once must never be worked out again.
      profiles: skeletonProfilesOf(useSkeletonProfiles.getState(), projectPath),
      onProfile: profile =>
        projectPath && useSkeletonProfiles.getState().rememberSkeletonProfile(projectPath, profile),
      onClipFit: (nodeId, clipKey, fit) =>
        useModelClips.getState().reportClipFit(documentId, nodeId, clipKey, fit),
      onRigProgress: (nodeId, progress) =>
        useModelClips.getState().reportRigProgress(documentId, nodeId, progress),
      onSelectBone: picked => useSceneViews.getState().setPickedBone(documentId, picked),
      onSelectPathPoint: picked => useSceneViews.getState().setPickedPathPoint(documentId, picked),
      onPathPoint: (nodeId, index, point) =>
        editPath(documentId, nodeId, path => withMovedPoint(path, index, point)),
      onAddPathPoint: (nodeId, index) => addPathPoint(documentId, nodeId, index),
      onAppendPathPoint: (nodeId, point) => appendPathPoint(documentId, nodeId, point),
      // Orbiting a pane locked onto a camera MOVES that camera: an edit of the document, so it
      // lands as a command — one per gesture, since the engine reports on release.
      onCameraMoved: (nodeId, transform) =>
        useScenes.getState().runCommand(documentId, setTransform(nodeId, transform)),
      onContextMenu: nodeId => openNodeMenu(documentId, nodeId),
      // `i18next.t` rather than the hook's, for the reason `openNodeMenu` reads it that way.
      onPathPointMenu: () =>
        openPathPointMenu({
          t: i18next.t,
          onRemove: () => removePickedPathPoint(documentId),
        }),
      onStats: (scene, selected) => setStats({ scene, selected }),
      // Published so a montage can look through this very view: a scene with no camera of its
      // own has no other framing anybody chose. Once per orbit, never per frame of one.
      onView: placement => useSceneViews.getState().setCamera(documentId, placement),
      onPane: pane => useSceneViews.getState().setActivePane(documentId, pane),
      assetVersion: assetVersionOf,
    })

    renderer.mount(element)
    engine.current = renderer
    // Registered so a panel that is not the viewport can ask it to draw a film — and forgotten
    // below, or an engine whose canvas is gone would still be handed out.
    registerSceneEngine(documentId, renderer)
    return () => {
      renderer.dispose()
      engine.current = null
      forgetSceneEngine(documentId)
      // The names came out of files this viewport parsed; nothing outside it can answer for them.
      useModelClips.getState().forget(documentId)
    }
  }, [documentId])

  // The engine holds no truth: every state change is pushed back into it.
  useEffect(() => {
    engine.current?.apply(scene)
  }, [scene])

  useShelfRefresh(() => engine.current?.refreshTextures())

  // Same for the viewport settings, which were three constants inside the engine.
  useEffect(() => {
    engine.current?.configure(viewport)
  }, [viewport])

  useEffect(() => {
    engine.current?.setMode(mode)
  }, [mode])

  useEffect(() => {
    engine.current?.setSnapping(view.snapping)
  }, [view.snapping])

  // What the VIEWPORT hides, which the document knows nothing about — see `isolation.ts`.
  useEffect(() => {
    engine.current?.setIsolation(view.isolation)
  }, [view.isolation])

  // The only line that knows both spellings; everything above it is a toggle like any other.
  useEffect(() => {
    engine.current?.setSpace(localFrame ? 'local' : 'world')
  }, [localFrame])

  useEffect(() => {
    engine.current?.setPoseMode(view.poseMode)
    // A bone picked in pose mode has no meaning outside it: leaving the mode lets go of it, or
    // the gizmo would keep holding a bone nothing can select any more.
    if (!view.poseMode) {
      engine.current?.setPickedBone(null)
      useSceneViews.getState().setPickedBone(documentId, null)
    }
  }, [documentId, view.poseMode])

  useEffect(() => {
    engine.current?.setPickedBone(view.pickedBone)
  }, [view.pickedBone])

  useEffect(() => {
    engine.current?.setPickedPathPoint(view.pickedPathPoint)
  }, [view.pickedPathPoint])

  // Session state, pushed like the rest: the engine is rebuilt from it after a remount, which is
  // what keeps an orthographic view orthographic when a panel is detached.
  useEffect(() => {
    engine.current?.setProjection(view.projection)
  }, [view.projection])

  useEffect(() => {
    engine.current?.setDisplayModes(view.displays, view.quadEdges)
  }, [view.displays, view.quadEdges])

  useEffect(() => {
    engine.current?.setSkeletons(view.skeletons)
  }, [view.skeletons])

  useEffect(() => {
    engine.current?.setQuadView(view.quad)
  }, [view.quad])

  useEffect(() => {
    engine.current?.setPaneViews(view.panes)
  }, [view.panes])

  // The head is session state React owns; the engine is told where it stands, never the reverse.
  useEffect(() => {
    engine.current?.setPlayhead(view.playhead)
  }, [view.playhead])

  // The block being watched, on the engine's own clock — the head stays where it was left.
  useEffect(() => {
    engine.current?.setPreview(view.preview)
  }, [view.preview])

  // Here rather than in the timeline panel, which is a tool window one may close: the head is the
  // scene's ONE clock, and closing a panel must not stop a character walking in the viewport.
  useAnimationPlayback(documentId, view.playing, scene.animation.duration)

  // Here rather than in the studio: a project only ever painted in has no business gaining four
  // texture assets, and by the time a hand reaches the Add menu the ids are known.
  useCheckerTextures()

  // Subscribed here rather than in `useNativeMenu`: an export reads the three.js objects, and
  // this component is the only thing that holds them.
  useExportMenu(active, bridge =>
    bridge.menu.onSceneExport(({ format, scope }) => {
      void exportScene(documentId, format, scope)
    }),
  )

  // The same reason, and the same arming: a capture reads the live renderer, and two open scenes
  // would otherwise both answer one click of the row.
  useExportMenu(active, bridge =>
    bridge.menu.onSceneCapture(({ quality }) => {
      void captureSceneView(documentId, quality)
    }),
  )

  /**
   * Which view a display command lands on: the one the pointer is over, as every modelling
   * package reads it. The engine is asked rather than React tracking it — the pointer is the
   * viewport's own business, and a second tally here is a second answer free to disagree.
   */
  const paneInHand = useCallback(() => engine.current?.activePane() ?? 0, [])

  const cycleDisplay = useCallback(() => {
    const pane = paneInHand()
    const displays = sceneViewOf(useSceneViews.getState(), documentId).displays
    useSceneViews
      .getState()
      .setDisplay(documentId, pane, nextDisplayMode(displayOfPane(displays, pane)))
  }, [documentId, paneInHand])

  // Single dispatch: the toolbar and the keyboard both resolve to a `CommandId` first, so a new
  // tool is declared once in `SCENE_TOOLS` and handled once here.
  const run = useCallback(
    (command: CommandId) => {
      // What acts on the selection is shared with the node menu, which arrives by the same ids —
      // see `runSceneCommand`. What is left below is what only this viewport can answer for.
      if (runSceneCommand(documentId, command)) return

      const store = useScenes.getState()

      switch (command) {
        case 'scene.select':
          return setMode('select')
        case 'scene.translate':
          return setMode('translate')
        case 'scene.rotate':
          return setMode('rotate')
        case 'scene.scale':
          return setMode('scale')
        case 'scene.snap':
          return useSceneViews.getState().setSceneSnapping(documentId, !view.snapping)
        // The rules themselves are in `sceneVisibility`, which the panel's buttons reach too:
        // « isolating is a toggle » must not be written once per surface.
        case 'scene.isolate':
          return changeIsolation(documentId, toggledIsolation)
        case 'scene.hide':
          return changeIsolation(documentId, (held, _nodes, ids) => hideIn(held, ids))
        case 'scene.showAll':
          return changeIsolation(documentId, () => NOTHING_ISOLATED)
        case 'scene.space':
          return setLocalFrame(current => !current)
        case 'scene.display':
          return cycleDisplay()
        // The keyboard and the palette take the view's own size; the menu rows carry the rest.
        case 'scene.capture':
          return void captureSceneView(documentId, DEFAULT_CAPTURE_QUALITY)
        case 'scene.skeletons':
          return useSceneViews.getState().setSkeletons(documentId, !view.skeletons)
        case 'scene.poseMode':
          return useSceneViews.getState().setPoseMode(documentId, !view.poseMode)
        case 'scene.quad':
          return useSceneViews.getState().setQuad(documentId, !view.quad)
        case 'scene.quadEdges':
          return useSceneViews.getState().setQuadEdges(documentId, !view.quadEdges)
        case 'scene.projection':
          return useSceneViews
            .getState()
            .setProjection(
              documentId,
              view.projection === 'perspective' ? 'orthographic' : 'perspective',
            )
        // The same door the right button of the viewport opens, and for the same question.
        // Never mid-flight: the very keys that open this menu are boost and strafe-left, and a
        // native menu takes the focus — the keyups then go to it and the boost stays held.
        case 'scene.add':
          return engine.current?.flying ? undefined : openNodeMenu(documentId, null)
        case 'scene.undo':
          return store.undo(documentId)
        case 'scene.redo':
          return store.redo(documentId)
      }
    },
    [documentId, view, cycleDisplay],
  )

  /** Two flyouts answer here: the ways of drawing, and the three families a scene grows by. */
  const runMode = useCallback(
    (toolId: string, modeId: string) => {
      const added = addedKind(toolId, modeId)
      if (added) return addNodeTo(documentId, added)

      if (isDisplayMode(modeId)) {
        useSceneViews.getState().setDisplay(documentId, paneInHand(), modeId)
      }
    },
    [documentId, paneInHand],
  )

  useShortcuts({
    scope: 'scene',
    // Dockview keeps hidden tabs mounted, and the hook swallows the keys it recognises: a
    // scene left in a background tab would eat the space bar the video space listens for.
    enabled: active,
    documentId,
    // Pushed on change, not polled: the engine restarts its own loop while something moves, so
    // nothing has to tick when the keyboard is idle.
    onMotionChange: held => engine.current?.setMotion(held),
    isFlying: () => engine.current?.flying ?? false,
    onCommand: run,
  })

  // Rebuilt only when something the bar SHOWS moves — a shortcut, a button's availability, a
  // toggle: the document re-renders on every transform release, and this maps every item of the
  // bar, each of them looking its key up through the registry.
  const nothingSelected = scene.selectedIds.length === 0
  const nothingHeld = useSceneClipboard(state => state.nodes.length === 0)
  // The boolean rather than the object: `hideIn` mints a fresh isolation on every hidden node,
  // which would remap all the tools for a state that has not changed.
  const isolated = isolating(view.isolation)
  const tools = useMemo(() => {
    // Keyed by command rather than by tool id, so a renamed command fails to compile instead of
    // quietly leaving a toggle unlit.
    const pressed: Partial<Record<CommandId, boolean>> = {
      'scene.snap': view.snapping,
      'scene.space': localFrame,
      'scene.projection': view.projection === 'orthographic',
      'scene.skeletons': view.skeletons,
      'scene.poseMode': view.poseMode,
      'scene.quad': view.quad,
      'scene.quadEdges': view.quadEdges,
      // The one tool of the bar whose armed state is not a setting: it says an isolation is
      // running, which is what makes leaving it the same press that entered it.
      'scene.isolate': isolated,
    }
    const unavailable: Partial<Record<CommandId, boolean>> = {
      'scene.delete': nothingSelected,
      'scene.duplicate': nothingSelected,
      'scene.group': nothingSelected,
      'scene.copy': nothingSelected,
      'scene.cut': nothingSelected,
      'scene.paste': nothingHeld,
      'scene.frame': nothingSelected,
      // Leaving one needs no selection, which is the whole point of a toggle that can be armed
      // with nothing picked.
      'scene.isolate': nothingSelected && !isolated,
      'scene.hide': nothingSelected,
      'scene.showAll': !isolated,
    }

    return [
      // Above the tools, and carrying no armed mode: their click opens the family rather than
      // arming anything — see `ADD_TOOLS`.
      ...ADD_TOOLS,
      ...SCENE_TOOLS.map(tool => ({
        ...tool,
        shortcut: label(bindingOf(tool.command, bindings)),
        activeMode: tool.id === 'display' ? displayOfPane(view.displays, 0) : undefined,
        disabled: unavailable[tool.command],
        pressed: pressed[tool.command],
        // Armed says « something is being kept from the view », which a plain Hide sets too —
        // so the word has to follow, or the button offers to isolate what it is about to reveal.
        ...(tool.id === 'isolate' && isolated
          ? {
              labelKey: 'sceneTools.leaveIsolation',
              descriptionKey: 'sceneTools.leaveIsolationHint',
            }
          : {}),
      })),
    ]
    // The fields of `view` this reads, not `view` itself: the store also carries the camera and
    // the picked bone, each written often and shown on no button of this bar.
  }, [
    bindings,
    label,
    nothingSelected,
    nothingHeld,
    view.snapping,
    localFrame,
    view.projection,
    view.skeletons,
    view.poseMode,
    view.quad,
    view.quadEdges,
    view.displays,
    isolated,
  ])

  return (
    // The whole surface, not the canvas: the renderer owns that one, and a drop landing on the
    // toolbar instead of beside it would be a miss the user cannot see coming.
    <AssetDropTarget
      accepts={MESHES}
      onDrop={asset => addModelTo(documentId, asset)}
      // No frame: see `ImageDocument` — a surface that fills the centre outlines what the user is
      // already looking at.
      outlined={false}
      className="relative size-full"
    >
      {/* The renderer makes its own canvas in here — see `SceneRenderer.mount`. */}
      <div ref={host} className="absolute inset-0" />
      <SceneCounters scene={stats.scene} selected={stats.selected} />
      <CameraPreview documentId={documentId} />
      {view.quad && (
        <ScenePaneGrid
          views={view.panes}
          cameras={scene.nodes.filter(node => node.type === 'camera')}
          onView={(pane, chosen) => useSceneViews.getState().setPaneView(documentId, pane, chosen)}
        />
      )}
      <Toolbar
        className={PANE_TOOLBAR}
        tools={tools}
        activeTool={mode}
        onTool={id => {
          const command = SCENE_TOOLS.find(candidate => candidate.id === id)?.command
          if (command) run(command)
        }}
        onMode={runMode}
      />
    </AssetDropTarget>
  )
}
