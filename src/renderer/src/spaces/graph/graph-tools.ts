import {
  mdiCursorDefaultOutline,
  mdiHandBackRightOutline,
  mdiMagnifyMinusOutline,
  mdiMagnifyPlusOutline,
  mdiPlay,
  mdiPlus,
  mdiRedo,
  mdiStop,
  mdiUndo,
} from '@mdi/js'
import type { ToolbarItem } from '@/design/Toolbar'

/** What the pointer does on the pane: pick things, or push the view around. */
export type GraphMode = 'select' | 'pan'

export type GraphToolId = 'run' | 'add' | GraphMode | 'undo' | 'redo' | 'zoomIn' | 'zoomOut'

export type GraphToolbarState = {
  canUndo: boolean
  canRedo: boolean
  /** Whether there is anything to run at all: an empty graph offers a button that does nothing. */
  canRun: boolean
  /** The same button, and deliberately: a run and its stop are one place to look, not two. */
  running: boolean
}

/**
 * The bar's registry, in the order Scenario's own editor reads: add, then how the pointer
 * behaves, then history, then zoom. Four groups of one to two buttons, separated.
 *
 * Undo and redo are declared HERE rather than handed to `Toolbar` through `onUndo`/`onRedo`,
 * which the other spaces use: that pair is drawn last, after everything else, and the order
 * above puts them in the middle. Their disabled state is what the pair would have given, and
 * `ToolbarItem` carries it.
 */
export function graphTools({
  canUndo,
  canRedo,
  canRun,
  running,
}: GraphToolbarState): ToolbarItem[] {
  return [
    {
      id: 'run',
      labelKey: running ? 'graphTools.stop' : 'graphTools.run',
      descriptionKey: running ? 'graphTools.stopHint' : 'graphTools.runHint',
      icon: running ? mdiStop : mdiPlay,
      // A run under way is always stoppable, whatever the graph holds by then.
      disabled: !running && !canRun,
    },
    {
      id: 'add',
      labelKey: 'graphTools.add',
      descriptionKey: 'graphTools.addHint',
      icon: mdiPlus,
      separatorBefore: true,
    },
    {
      id: 'select',
      labelKey: 'graphTools.select',
      descriptionKey: 'graphTools.selectHint',
      icon: mdiCursorDefaultOutline,
      separatorBefore: true,
    },
    {
      id: 'pan',
      labelKey: 'graphTools.pan',
      descriptionKey: 'graphTools.panHint',
      icon: mdiHandBackRightOutline,
    },
    {
      id: 'undo',
      labelKey: 'actions.undo',
      descriptionKey: 'actions.undoHint',
      icon: mdiUndo,
      disabled: !canUndo,
      separatorBefore: true,
    },
    {
      id: 'redo',
      labelKey: 'actions.redo',
      descriptionKey: 'actions.redoHint',
      icon: mdiRedo,
      disabled: !canRedo,
    },
    {
      id: 'zoomIn',
      labelKey: 'graphTools.zoomIn',
      descriptionKey: 'graphTools.zoomInHint',
      icon: mdiMagnifyPlusOutline,
      separatorBefore: true,
    },
    {
      id: 'zoomOut',
      labelKey: 'graphTools.zoomOut',
      descriptionKey: 'graphTools.zoomOutHint',
      icon: mdiMagnifyMinusOutline,
    },
  ]
}
