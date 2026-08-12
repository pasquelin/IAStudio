import type { AssetType } from '@shared/domain/asset'
import { bindingOf, type CommandId } from '@shared/domain/command'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import type { ExportFormat } from '@shared/domain/scene'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PANE_TOOLBAR } from '@/design/styles'
import { Toolbar } from '@/design/Toolbar'
import { canRedo, canUndo } from '@/engines/core/history'
import { addNodes, copiesOf, groupNodes, removeNodes, rootedIn } from '@/engines/scene/commands'
import { movesToCommand } from '@/engines/scene/animation-commands'
import { animationViewOf, useAnimationViews } from '@/stores/animation-view'
import { snapToFrame } from '@shared/domain/time'
import { SceneRenderer, type TransformMode } from '@/engines/scene/SceneRenderer'
import { setDocumentTitle } from '@/app/dockview-api'
import { useAddNode } from '@/hooks/useAddNode'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useDocuments } from '@/stores/documents'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useSettings } from '@/stores/settings'
import { useBindingOverrides } from '@/stores/bindings'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { selectedNodes, type NodeMove } from '@/engines/scene/scene-state'
import { useModelClips } from '@/stores/model-clips'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/scene-engines'
import { useSceneClipboard } from '@/stores/scene-clipboard'
import { addModelTo, sceneHistoryOf, isDirty, sceneOf, selectIn, useScenes } from '@/stores/scenes'
import { displayOfPane, useSceneViews, viewOf } from '@/stores/scene-views'
import { isDisplayMode, isViewDirection, nextDisplayMode } from '@/engines/scene/scene-view'
import { EMPTY_STATS, type SceneStats } from '@/engines/scene/scene-stats'
import { SceneCounters } from './SceneCounters'
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
  const at = snapToFrame(viewOf(useSceneViews.getState(), documentId).playhead, state.animation.fps)
  const recording = animationViewOf(useAnimationViews.getState(), documentId).autoKey

  const command = movesToCommand(state, moves, at, recording)
  if (command) store.runCommand(documentId, command)
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
  // Booleans rather than the history itself: a selector that builds an object on every call
  // hands React a new snapshot each render, and the render loop never settles.
  const undoable = useScenes(state => canUndo(sceneHistoryOf(state, documentId)))
  const redoable = useScenes(state => canRedo(sceneHistoryOf(state, documentId)))
  const modified = useScenes(state => isDirty(state, documentId))
  const title = useDocuments(state => state.documents[documentId]?.title)
  const bindings = useBindingOverrides()
  const label = useShortcutLabel()
  const addNodeOf = useAddNode(documentId)
  const active = useDocuments(state => state.activeId === documentId)
  const viewport = useSettings(state => state.settings.three)
  const view = useSceneViews(state => viewOf(state, documentId))

  // Before the renderer mounts: a saved document comes back from the project, a new one from
  // the default scene — an unlit viewport reads as broken rather than as empty.
  useRestoredDocument(documentId)

  useEffect(() => {
    if (title) setDocumentTitle(documentId, title, modified)
  }, [documentId, title, modified])

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
      onStats: (scene, selected) => setStats({ scene, selected }),
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
    const displays = viewOf(useSceneViews.getState(), documentId).displays
    useSceneViews
      .getState()
      .setDisplay(documentId, pane, nextDisplayMode(displayOfPane(displays, pane)))
  }, [documentId, paneInHand])

  // Single dispatch: the toolbar and the keyboard both resolve to a `CommandId` first, so a new
  // tool is declared once in `SCENE_TOOLS` and handled once here.
  const run = useCallback(
    (command: CommandId) => {
      const store = useScenes.getState()
      const { nodes, selectedIds } = sceneOf(store, documentId)
      const picked = selectedNodes(nodes, selectedIds)

      switch (command) {
        case 'scene.select':
          return setMode('select')
        case 'scene.translate':
          return setMode('translate')
        case 'scene.rotate':
          return setMode('rotate')
        case 'scene.scale':
          return setMode('scale')
        case 'scene.frame':
          return engine.current?.frameSelection()
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
        case 'scene.delete':
          if (selectedIds.length > 0) store.runCommand(documentId, removeNodes(nodes, selectedIds))
          return
        case 'scene.duplicate':
          if (picked.length > 0) store.runCommand(documentId, addNodes(copiesOf(nodes, picked)))
          return
        case 'scene.copy':
          if (picked.length > 0) useSceneClipboard.getState().copy(copiesOf(nodes, picked))
          return
        case 'scene.cut':
          if (picked.length === 0) return
          useSceneClipboard.getState().copy(copiesOf(nodes, picked))
          store.runCommand(documentId, removeNodes(nodes, selectedIds))
          return
        case 'scene.paste': {
          // Copied again on the way out: pasting twice must not put the same ids in twice.
          const held = useSceneClipboard.getState().nodes
          if (held.length === 0) return
          store.runCommand(documentId, addNodes(rootedIn(copiesOf(held, held), nodes)))
          return
        }
        case 'scene.group':
          if (picked.length > 0) store.runCommand(documentId, groupNodes(picked))
          return
        case 'scene.undo':
          return store.undo(documentId)
        case 'scene.redo':
          return store.redo(documentId)
      }
    },
    [documentId, view, cycleDisplay],
  )

  /** A flyout row: the Add rows name a node kind, the others a side to stand at or a way to draw. */
  const runMode = useCallback(
    (toolId: string, modeId: string) => {
      if (toolId === 'view' && isViewDirection(modeId)) return engine.current?.viewFrom(modeId)
      if (toolId === 'display' && isDisplayMode(modeId)) {
        return useSceneViews.getState().setDisplay(documentId, paneInHand(), modeId)
      }
      addNodeOf(modeId)
    },
    [documentId, addNodeOf, paneInHand],
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
      shortcut: tool.command ? label(bindingOf(tool.command, bindings)) : undefined,
      activeMode: tool.id === 'display' ? displayOfPane(view.displays, 0) : undefined,
      disabled: tool.command ? unavailable[tool.command] : undefined,
      pressed: tool.command ? pressed[tool.command] : undefined,
    }))
  }, [bindings, label, nothingSelected, nothingHeld, snapping, localFrame, view])

  return (
    // The whole surface, not the canvas: the renderer owns that one, and a drop landing on the
    // toolbar instead of beside it would be a miss the user cannot see coming.
    <AssetDropTarget
      accepts={MESHES}
      onDrop={asset => addModelTo(documentId, asset)}
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
        onMode={(toolId, modeId) => runMode(toolId, modeId)}
        onUndo={() => run('scene.undo')}
        onRedo={() => run('scene.redo')}
        undoShortcut={label(bindingOf('scene.undo', bindings))}
        redoShortcut={label(bindingOf('scene.redo', bindings))}
        canUndo={undoable}
        canRedo={redoable}
      />
    </AssetDropTarget>
  )
}
