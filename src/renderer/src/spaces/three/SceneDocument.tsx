import type { AssetType } from '@shared/domain/asset'
import { bindingOf, type CommandId } from '@shared/domain/command'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import type { ExportFormat } from '@shared/domain/scene'
import i18next from 'i18next'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PANE_TOOLBAR } from '@/design/styles'
import { Toolbar } from '@/design/Toolbar'
import { nodeById } from '@/engines/scene/scene-state'
import { movesToCommand } from '@/engines/scene/animation-commands'
import { animationViewOf, useAnimationViews } from '@/stores/animation-view'
import { snapToFrame } from '@shared/domain/time'
import { SceneRenderer, type TransformMode } from '@/engines/scene/SceneRenderer'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useDocuments } from '@/stores/documents'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useSettings } from '@/stores/settings'
import { useBindingOverrides } from '@/stores/bindings'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { assetVersionOf } from '@/stores/assets'
import { useShelfRefresh } from '@/hooks/useShelfRefresh'
import type { NodeMove } from '@/engines/scene/scene-state'
import { useModelClips } from '@/stores/model-clips'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/scene-engines'
import { useSceneClipboard } from '@/stores/scene-clipboard'
import { addModelTo, isSceneDirty, sceneOf, selectIn, useScenes } from '@/stores/scenes'
import { displayOfPane, useSceneViews, sceneViewOf } from '@/stores/scene-views'
import { nextDisplayMode } from '@/engines/scene/scene-view'
import { isDisplayMode } from '@shared/domain/scene'
import { EMPTY_STATS, type SceneStats } from '@/engines/scene/scene-stats'
import { SceneCounters } from './SceneCounters'
import { openSceneNodeMenu } from './SceneNodeMenu'
import { runSceneCommand, toggleNodeVisible } from './scene-commands'
import { ScenePaneGrid } from './ScenePaneGrid'
import { SCENE_TOOLS } from './scene-tools'

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
  engine: SceneRenderer | null,
  format: ExportFormat,
  scope: 'scene' | 'selection',
): Promise<void> {
  const bridge = getBridge()
  if (!engine || !bridge) return

  try {
    const data = await engine.exportTo(format, scope)
    const name = useDocuments.getState().documents[documentId]?.title ?? 'scene'
    await bridge.scene.export({ name, format, data })
  } catch (error) {
    reportFailure('scene.export', format, error)
  }
}

/**
 * The two store reads a gizmo drag needs; the rule itself is `movesToCommand`, which is pure and
 * therefore testable — a viewport is not.
 */
function recordTransform(documentId: string, moves: readonly NodeMove[]): void {
  const store = useScenes.getState()
  const state = sceneOf(store, documentId)
  const at = snapToFrame(
    sceneViewOf(useSceneViews.getState(), documentId).playhead,
    state.animation.fps,
  )
  const recording = animationViewOf(useAnimationViews.getState(), documentId).autoKey

  const command = movesToCommand(state, moves, at, recording)
  if (command) store.runCommand(documentId, command)
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
 * the reason `document-io` reads it that way — this runs from an engine callback, outside any
 * render, and the singleton is always the language in force.
 */
function openNodeMenu(documentId: string, nodeId: string): void {
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
  // Session state, like the mode: a document that remembered its snapping would impose it on
  // whoever opens it next.
  const [snapping, setSnapping] = useState(false)
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
  const active = useDocuments(state => state.activeId === documentId)
  const viewport = useSettings(state => state.settings.three)
  const view = useSceneViews(state => sceneViewOf(state, documentId))

  // Before the renderer mounts: a saved document comes back from the project, a new one from
  // the default scene — an unlit viewport reads as broken rather than as empty.
  useRestoredDocument(documentId)

  useDocumentTitle(documentId, modified)

  useEffect(() => {
    const element = host.current
    if (!element) return

    const renderer = new SceneRenderer({
      // A click in the void with a modifier held keeps the selection: `toggle` of nothing is
      // nothing, which is what stops a near miss from undoing the picking that came before it.
      onSelect: (ids, mode) => selectIn(documentId, ids, mode),
      onTransform: moves => recordTransform(documentId, moves),
      onClips: (nodeId, clips, lengths) =>
        useModelClips.getState().report(documentId, nodeId, clips, lengths),
      onBones: (nodeId, bones) => useModelClips.getState().reportBones(documentId, nodeId, bones),
      onSelectBone: picked => useSceneViews.getState().setPickedBone(documentId, picked),
      onContextMenu: nodeId => openNodeMenu(documentId, nodeId),
      onStats: (scene, selected) => setStats({ scene, selected }),
      // Published so a montage can look through this very view: a scene with no camera of its
      // own has no other framing anybody chose. Once per orbit, never per frame of one.
      onView: placement => useSceneViews.getState().setCamera(documentId, placement),
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
    engine.current?.setSnapping(snapping)
  }, [snapping])

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

  // Subscribed here rather than in `useNativeMenu`: an export reads the three.js objects, and
  // this component is the only thing that holds them. Only while this tab is in front, or two
  // open scenes would both answer one menu click.
  useEffect(() => {
    const bridge = getBridge()
    if (!bridge || !active) return

    return bridge.menu.onSceneExport(({ format, scope }) => {
      void exportScene(documentId, engine.current, format, scope)
    })
  }, [documentId, active])

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
          return setSnapping(current => !current)
        case 'scene.space':
          return setLocalFrame(current => !current)
        case 'scene.display':
          return cycleDisplay()
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
        case 'scene.undo':
          return store.undo(documentId)
        case 'scene.redo':
          return store.redo(documentId)
      }
    },
    [documentId, view, cycleDisplay],
  )

  /** The one flyout left on this bar names a way to draw; Add and the six sides are menu rows. */
  const runMode = useCallback(
    (modeId: string) => {
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
    // Pushed on change, not polled: the engine restarts its own loop while something moves, so
    // nothing has to tick when the keyboard is idle.
    onMotionChange: held => engine.current?.setMotion(held),
    onCommand: run,
  })

  // Rebuilt only when something the bar shows moves — a shortcut, a button's availability, a
  // toggle: the document re-renders on every transform release, and each item carries the
  // 22-entry Add flyout.
  const nothingSelected = scene.selectedIds.length === 0
  const nothingHeld = useSceneClipboard(state => state.nodes.length === 0)
  const tools = useMemo(() => {
    // Keyed by command rather than by tool id, so a renamed command fails to compile instead of
    // quietly leaving a toggle unlit.
    const pressed: Partial<Record<CommandId, boolean>> = {
      'scene.snap': snapping,
      'scene.space': localFrame,
      'scene.projection': view.projection === 'orthographic',
      'scene.skeletons': view.skeletons,
      'scene.poseMode': view.poseMode,
      'scene.quad': view.quad,
      'scene.quadEdges': view.quadEdges,
    }
    const unavailable: Partial<Record<CommandId, boolean>> = {
      'scene.delete': nothingSelected,
      'scene.duplicate': nothingSelected,
      'scene.copy': nothingSelected,
      'scene.cut': nothingSelected,
      'scene.paste': nothingHeld,
    }

    return SCENE_TOOLS.map(tool => ({
      ...tool,
      shortcut: label(bindingOf(tool.command, bindings)),
      activeMode: tool.id === 'display' ? displayOfPane(view.displays, 0) : undefined,
      disabled: unavailable[tool.command],
      pressed: pressed[tool.command],
    }))
  }, [bindings, label, nothingSelected, nothingHeld, snapping, localFrame, view])

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
      {view.quad && (
        <ScenePaneGrid
          views={view.panes}
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
        onMode={(_toolId, modeId) => runMode(modeId)}
      />
    </AssetDropTarget>
  )
}
