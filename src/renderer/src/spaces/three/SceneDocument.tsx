import { useEffect, useRef, useState } from 'react'
import { Toolbar } from '@/design/Toolbar'
import { canRedo, canUndo } from '@/engines/core/history'
import { removeObject, selectObject, setTransform } from '@/engines/scene/commands'
import { SceneRenderer, type TransformMode } from '@/engines/scene/SceneRenderer'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useKeymap } from '@/stores/keymap'
import { historyOf, sceneOf, useScenes } from '@/stores/scenes'
import { SCENE_TOOLS, shortcutLabel } from './scene-tools'

const MODE_BY_TOOL: Record<string, TransformMode> = {
  translate: 'translate',
  rotate: 'rotate',
  scale: 'scale',
}

export function SceneDocument({ documentId }: { documentId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<SceneRenderer | null>(null)
  const [mode, setMode] = useState<TransformMode>('translate')

  const scene = useScenes(state => sceneOf(state, documentId))
  // Booleans rather than the history itself: a selector that builds an object on every call
  // hands React a new snapshot each render, and the render loop never settles.
  const undoable = useScenes(state => canUndo(historyOf(state, documentId)))
  const redoable = useScenes(state => canRedo(historyOf(state, documentId)))
  const bindings = useKeymap(state => state.bindings)

  useEffect(() => {
    const element = canvas.current
    if (!element) return

    const renderer = new SceneRenderer({
      onSelect: id => {
        const store = useScenes.getState()
        store.setScene(documentId, selectObject(sceneOf(store, documentId), id))
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

  useShortcuts({
    enabled: true,
    // Pushed on change, not polled: the engine restarts its own loop while something moves, so
    // nothing has to tick when the keyboard is idle.
    onMotionChange: held => engine.current?.setMotion(held),
    onCommand: command => {
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
          if (selected) store.runCommand(documentId, removeObject(selected))
          return
        }
        case 'scene.undo':
          return store.undoScene(documentId)
        case 'scene.redo':
          return store.redoScene(documentId)
      }
    },
  })

  const tools = SCENE_TOOLS.map(tool => ({
    ...tool,
    shortcut: shortcutLabel(bindings[tool.command]),
    disabled: tool.id === 'delete' && scene.selectedId === null,
  }))

  return (
    <div className="relative size-full">
      <canvas ref={canvas} className="block size-full" />
      <Toolbar
        className="absolute top-2 left-2"
        tools={tools}
        activeTool={mode}
        onTool={id => {
          const next = MODE_BY_TOOL[id]
          if (next) return setMode(next)
          if (id === 'frame') return engine.current?.frameSelection()
          if (id === 'delete' && scene.selectedId)
            useScenes.getState().runCommand(documentId, removeObject(scene.selectedId))
        }}
        onUndo={() => useScenes.getState().undoScene(documentId)}
        onRedo={() => useScenes.getState().redoScene(documentId)}
        canUndo={undoable}
        canRedo={redoable}
      />
    </div>
  )
}
