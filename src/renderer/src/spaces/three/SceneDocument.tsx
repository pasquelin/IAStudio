import { useCallback, useEffect, useRef, useState } from 'react'
import { shortcutLabel, type CommandId } from '@shared/domain/shortcut'
import { Toolbar } from '@/design/Toolbar'
import { canRedo, canUndo } from '@/engines/core/history'
import { removeNode, selectNode, setTransform } from '@/engines/scene/commands'
import { createDefaultScene } from '@/engines/scene/default-scene'
import { SceneRenderer, type TransformMode } from '@/engines/scene/SceneRenderer'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useKeymap } from '@/stores/keymap'
import { historyOf, sceneOf, useScenes } from '@/stores/scenes'
import { SCENE_TOOLS } from './scene-tools'

export function SceneDocument({ documentId }: { documentId: string }) {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<SceneRenderer | null>(null)
  const [mode, setMode] = useState<TransformMode>('translate')

  const scene = useScenes(state => sceneOf(state, documentId))
  // Booleans rather than the history itself: a selector that builds an object on every call
  // hands React a new snapshot each render, and the render loop never settles.
  const undoable = useScenes(state => canUndo(historyOf(state, documentId)))
  const redoable = useScenes(state => canRedo(historyOf(state, documentId)))
  const bindings = useKeymap(state => state.bindings)

  // Before the renderer mounts: a scene that arrives unlit shows nothing, and reads as a broken
  // viewport rather than as an empty document.
  useEffect(() => {
    useScenes.getState().ensure(documentId, createDefaultScene)
  }, [documentId])

  useEffect(() => {
    const element = host.current
    if (!element) return

    const renderer = new SceneRenderer({
      onSelect: id => {
        const store = useScenes.getState()
        store.replace(documentId, selectNode(sceneOf(store, documentId), id))
      },
      onTransform: (id, transform) =>
        useScenes.getState().runCommand(documentId, setTransform(id, transform)),
    })

    renderer.mount(element)
    engine.current = renderer
    return () => {
      renderer.dispose()
      engine.current = null
    }
  }, [documentId])

  // The engine holds no truth: every state change is pushed back into it.
  useEffect(() => {
    engine.current?.apply(scene)
  }, [scene])

  useEffect(() => {
    engine.current?.setMode(mode)
  }, [mode])

  // Single dispatch: the toolbar and the keyboard both resolve to a `CommandId` first, so a new
  // tool is declared once in `SCENE_TOOLS` and handled once here.
  const run = useCallback(
    (command: CommandId) => {
      const store = useScenes.getState()
      switch (command) {
        case 'scene.translate':
          return setMode('translate')
        case 'scene.rotate':
          return setMode('rotate')
        case 'scene.scale':
          return setMode('scale')
        case 'scene.frame':
          return engine.current?.frameSelection()
        case 'scene.delete': {
          const selected = sceneOf(store, documentId).selectedId
          if (selected) store.runCommand(documentId, removeNode(selected))
          return
        }
        case 'scene.undo':
          return store.undo(documentId)
        case 'scene.redo':
          return store.redo(documentId)
      }
    },
    [documentId],
  )

  useShortcuts({
    enabled: true,
    // Pushed on change, not polled: the engine restarts its own loop while something moves, so
    // nothing has to tick when the keyboard is idle.
    onMotionChange: held => engine.current?.setMotion(held),
    onCommand: run,
  })

  const tools = SCENE_TOOLS.map(tool => ({
    ...tool,
    shortcut: shortcutLabel(bindings[tool.command]),
    disabled: tool.command === 'scene.delete' && scene.selectedId === null,
  }))

  return (
    <div className="relative size-full">
      {/* The renderer makes its own canvas in here — see `SceneRenderer.mount`. */}
      <div ref={host} className="absolute inset-0" />
      <Toolbar
        className="absolute top-2 left-2"
        tools={tools}
        activeTool={mode}
        onTool={id => {
          const tool = SCENE_TOOLS.find(candidate => candidate.id === id)
          if (tool) run(tool.command)
        }}
        onUndo={() => run('scene.undo')}
        onRedo={() => run('scene.redo')}
        undoShortcut={shortcutLabel(bindings['scene.undo'])}
        redoShortcut={shortcutLabel(bindings['scene.redo'])}
        canUndo={undoable}
        canRedo={redoable}
      />
    </div>
  )
}
