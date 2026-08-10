import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Toolbar } from '@/design/Toolbar'
import { useBinding } from '@/stores/bindings'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { graphTools, type GraphMode, type GraphToolbarState } from './graph-tools'

/** `runShortcut` is absent on purpose: the bar reads the binding itself, just below. */
export type GraphToolbarProps = Omit<GraphToolbarState, 'runShortcut'> & {
  mode: GraphMode
  onMode: (mode: GraphMode) => void
  /** Called with the point the menu should open at — viewport coordinates, as a click reports. */
  onAdd: (at: { x: number; y: number }) => void
  onUndo: () => void
  onRedo: () => void
  /** One handler for the pair: the button says which of the two it is offering right now. */
  onRun: () => void
  onExport: () => void
  onPublish: () => void
  onImport: () => void
}

/**
 * The canvas's own bar, floating over it — the studio's `Toolbar`, not React Flow's `<Controls>`.
 *
 * Rendered INSIDE `<ReactFlow>` so `useReactFlow` reaches the viewport it zooms; React Flow lays
 * its children over the pane, which is where a floating bar belongs. Left edge, like the 3D and
 * image spaces, so the eye finds it in the same place in every workspace.
 */
export function GraphToolbar({
  mode,
  onMode,
  onAdd,
  onUndo,
  onRedo,
  onRun,
  onExport,
  onPublish,
  onImport,
  canUndo,
  canRedo,
  canRun,
  canExport,
  running,
}: GraphToolbarProps) {
  const { zoomIn, zoomOut } = useReactFlow()
  // Read here rather than passed from the document: the bar is the only thing that draws it, and
  // a remap in the settings has to reach the button without the document knowing about keys.
  const runShortcut = useShortcutLabel()(useBinding('graph.run'))
  const bar = useRef<HTMLDivElement | null>(null)

  /**
   * Beside the button rather than under it: the bar hugs the left edge, and a menu opening
   * downward from a button at the top would cover the tools below it. Falls back to the middle
   * of the window if the bar has not been measured, which no click can reach anyway.
   */
  const pointBesideBar = (): { x: number; y: number } => {
    const box = bar.current?.getBoundingClientRect()
    if (!box) return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    return { x: box.right + 8, y: box.top }
  }

  const onTool = useCallback(
    (id: string): void => {
      if (id === 'run') return onRun()
      if (id === 'export') return onExport()
      if (id === 'publish') return onPublish()
      if (id === 'import') return onImport()
      if (id === 'add') return onAdd(pointBesideBar())
      if (id === 'select' || id === 'pan') return onMode(id)
      if (id === 'undo') return onUndo()
      if (id === 'redo') return onRedo()
      if (id === 'zoomIn') return void zoomIn()
      if (id === 'zoomOut') return void zoomOut()
    },
    [onAdd, onMode, onUndo, onRedo, onRun, onExport, onPublish, onImport, zoomIn, zoomOut],
  )

  return (
    <div ref={bar} className="absolute top-2 left-2 z-10">
      <Toolbar
        tools={graphTools({ canUndo, canRedo, canRun, canExport, running, runShortcut })}
        activeTool={mode}
        onTool={onTool}
      />
    </div>
  )
}
