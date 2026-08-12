import {
  mdiCursorDefaultOutline,
  mdiCloudUploadOutline,
  mdiTrayArrowUp,
  mdiTrayArrowDown,
  mdiHandBackRightOutline,
  mdiMagnifyMinusOutline,
  mdiMagnifyPlusOutline,
  mdiPlay,
  mdiPlus,
  mdiStop,
} from '@mdi/js'
import type { ToolbarItem } from '@/design/Toolbar'

/** What the pointer does on the pane: pick things, or push the view around. */
export type GraphMode = 'select' | 'pan'

export type GraphToolId = 'run' | 'export' | 'add' | GraphMode | 'zoomIn' | 'zoomOut'

export type GraphToolbarState = {
  /** Whether a run would report anything: a graph of notes offers a button that does nothing. */
  canRun: boolean
  /** An empty graph writes a file nothing can open, and publishes an App that answers nothing. */
  canExport: boolean
  /** A run under way owns the nodes on the canvas: replacing them under it lands its results on
   * a graph that never asked for them. */
  canImport: boolean
  /** The same button, and deliberately: a run and its stop are one place to look, not two. */
  running: boolean
  /**
   * The key `graph.run` answers to, already spelled for the screen. Passed in rather than read
   * here: a remap has to move the button with the menu, and this file has no hook to read one.
   */
  runShortcut: string
}

/**
 * The bar's registry, in the order Scenario's own editor reads: add, then how the pointer
 * behaves, then zoom. History is not here — the Edit menu carries it, as for every surface.
 */
export function graphTools({
  canRun,
  canExport,
  canImport,
  running,
  runShortcut,
}: GraphToolbarState): ToolbarItem[] {
  return [
    {
      id: 'run',
      labelKey: running ? 'graphTools.stop' : 'graphTools.run',
      descriptionKey: running ? 'graphTools.stopHint' : 'graphTools.runHint',
      icon: running ? mdiStop : mdiPlay,
      // A run under way is always stoppable, whatever the graph holds by then.
      disabled: !running && !canRun,
      shortcut: runShortcut,
    },
    {
      id: 'export',
      labelKey: 'graphTools.export',
      descriptionKey: 'graphTools.exportHint',
      icon: mdiTrayArrowDown,
      disabled: !canExport,
    },
    {
      id: 'publish',
      labelKey: 'graphTools.publish',
      descriptionKey: 'graphTools.publishHint',
      icon: mdiCloudUploadOutline,
      disabled: !canExport,
    },
    {
      id: 'import',
      labelKey: 'graphTools.import',
      descriptionKey: 'graphTools.importHint',
      icon: mdiTrayArrowUp,
      disabled: !canImport,
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
