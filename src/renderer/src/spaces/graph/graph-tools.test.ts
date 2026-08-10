import { describe, expect, it } from 'vitest'
import { graphTools, type GraphToolbarState } from './graph-tools'

const bar = (given: Partial<GraphToolbarState> = {}): GraphToolbarState => ({
  canUndo: false,
  canRedo: false,
  canRun: true,
  running: false,
  runShortcut: '⌘Entrée',
  ...given,
})

const tool = (state: GraphToolbarState, id: string): boolean | undefined =>
  graphTools(state).find(item => item.id === id)?.disabled

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
