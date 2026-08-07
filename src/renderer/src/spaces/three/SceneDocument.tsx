import { bindingOf, type CommandId } from '@shared/domain/command'
import { shortcutLabel } from '@shared/domain/shortcut'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Toolbar } from '@/design/Toolbar'
import { canRedo, canUndo } from '@/engines/core/history'
import { removeNode, selectNode, setTransform } from '@/engines/scene/commands'
import { SceneRenderer, type TransformMode } from '@/engines/scene/SceneRenderer'
import { restoreDocument } from '@/app/document-io'
import { setDocumentTitle } from '@/app/DocumentArea'
import { useAddNode } from '@/hooks/useAddNode'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useDocuments } from '@/stores/documents'
import { useSettings } from '@/stores/settings'
import { useBindingOverrides } from '@/stores/bindings'
import { historyOf, isDirty, sceneOf, useScenes } from '@/stores/scenes'
import { SCENE_TOOLS } from './scene-tools'

export function SceneDocument({ documentId }: { documentId: string }) {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<SceneRenderer | null>(null)
  const [mode, setMode] = useState<TransformMode>('select')

  const scene = useScenes(state => sceneOf(state, documentId))
  // Booleans rather than the history itself: a selector that builds an object on every call
  // hands React a new snapshot each render, and the render loop never settles.
  const undoable = useScenes(state => canUndo(historyOf(state, documentId)))
  const redoable = useScenes(state => canRedo(historyOf(state, documentId)))
  const modified = useScenes(state => isDirty(state, documentId))
  const title = useDocuments(state => state.documents[documentId]?.title)
  const bindings = useBindingOverrides()
  const addNodeOf = useAddNode(documentId)
  const active = useDocuments(state => state.activeId === documentId)
  const viewport = useSettings(state => state.settings.three)

  // Before the renderer mounts: a saved document comes back from the project, a new one from
  // the default scene — an unlit viewport reads as broken rather than as empty.
  useEffect(() => {
    void restoreDocument(documentId)
  }, [documentId])

  useEffect(() => {
    if (title) setDocumentTitle(documentId, title, modified)
  }, [documentId, title, modified])

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

  // Same for the viewport settings, which were three constants inside the engine.
  useEffect(() => {
    engine.current?.configure(viewport)
  }, [viewport])

  useEffect(() => {
    engine.current?.setMode(mode)
  }, [mode])

  // Single dispatch: the toolbar and the keyboard both resolve to a `CommandId` first, so a new
  // tool is declared once in `SCENE_TOOLS` and handled once here.
  const run = useCallback(
    (command: CommandId) => {
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
    scope: 'scene',
    // Dockview keeps hidden tabs mounted, and the hook swallows the keys it recognises: a
    // scene left in a background tab would eat the space bar the video space listens for.
    enabled: active,
    // Pushed on change, not polled: the engine restarts its own loop while something moves, so
    // nothing has to tick when the keyboard is idle.
    onMotionChange: held => engine.current?.setMotion(held),
    onCommand: run,
  })

  // Rebuilt only when a shortcut or the delete button's availability moves: the document
  // re-renders on every transform release, and each item carries the 22-entry Add flyout.
  const nothingSelected = scene.selectedId === null
  const tools = useMemo(
    () =>
      SCENE_TOOLS.map(tool => ({
        ...tool,
        shortcut: tool.command ? shortcutLabel(bindingOf(tool.command, bindings)) : undefined,
        disabled: tool.command === 'scene.delete' && nothingSelected,
      })),
    [bindings, nothingSelected],
  )

  return (
    <div className="relative size-full">
      {/* The renderer makes its own canvas in here — see `SceneRenderer.mount`. */}
      <div ref={host} className="absolute inset-0" />
      <Toolbar
        className="absolute top-2 left-2"
        tools={tools}
        activeTool={mode}
        onTool={id => {
          const command = SCENE_TOOLS.find(candidate => candidate.id === id)?.command
          if (command) run(command)
        }}
        onMode={(_toolId, kind) => addNodeOf(kind)}
        onUndo={() => run('scene.undo')}
        onRedo={() => run('scene.redo')}
        undoShortcut={shortcutLabel(bindingOf('scene.undo', bindings))}
        redoShortcut={shortcutLabel(bindingOf('scene.redo', bindings))}
        canUndo={undoable}
        canRedo={redoable}
      />
    </div>
  )
}
