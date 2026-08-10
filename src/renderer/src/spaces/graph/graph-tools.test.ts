import { describe, expect, it } from 'vitest'
import { graphTools, type GraphToolbarState } from './graph-tools'

const bar = (given: Partial<GraphToolbarState> = {}): GraphToolbarState => ({
  canUndo: false,
  canRedo: false,
  canRun: true,
  canExport: true,
  running: false,
  runShortcut: '⌘Entrée',
  ...given,
})

const tool = (state: GraphToolbarState, id: string): boolean | undefined =>
  graphTools(state).find(item => item.id === id)?.disabled

describe('the export button', () => {
  /** `workflow_create` refuses empty `nodes`/`edges`: an empty graph writes a file nothing opens. */
  it('offers nothing to export on a graph with no node', () => {
    expect(tool(bar({ canExport: false }), 'export')).toBe(true)
  })

  it('offers the export as soon as the graph holds something', () => {
    expect(tool(bar({ canExport: true }), 'export')).toBe(false)
  })

  /**
   * Beside the run rather than at the end: both act on the whole graph, and the groups after it
   * are about one node or about the view.
   */
  it('sits beside the run, before the group that adds a node', () => {
    expect(graphTools(bar()).map(item => item.id)).toEqual([
      'run',
      'export',
      'publish',
      'add',
      'select',
      'pan',
      'undo',
      'redo',
      'zoomIn',
      'zoomOut',
    ])
  })
})

describe('the publish button', () => {
  /** Same guard as the export: an empty graph publishes an App that answers nothing. */
  it('follows the export, and goes grey with it', () => {
    expect(tool(bar({ canExport: false }), 'publish')).toBe(true)
    expect(tool(bar({ canExport: true }), 'publish')).toBe(false)
  })
})

describe('the run button', () => {
  it('offers nothing to run on a graph with no node', () => {
    expect(tool(bar({ canRun: false }), 'run')).toBe(true)
  })

  it('offers the run as soon as the graph holds something', () => {
    expect(tool(bar({ canRun: true }), 'run')).toBe(false)
  })

  /**
   * The pair is one button, and a stop that goes grey is a run nobody can call off: the last node
   * deleted while its jobs are on the wire would leave the graph paying for a run with no way out.
   */
  it('stays live while a run is under way, whatever the graph still holds', () => {
    expect(tool(bar({ canRun: false, running: true }), 'run')).toBe(false)
  })
})

describe('the history pair', () => {
  it('greys each half until its own stack has something in it', () => {
    expect(tool(bar(), 'undo')).toBe(true)
    expect(tool(bar(), 'redo')).toBe(true)
    expect(tool(bar({ canUndo: true, canRedo: true }), 'undo')).toBe(false)
    expect(tool(bar({ canUndo: true, canRedo: true }), 'redo')).toBe(false)
  })
})
