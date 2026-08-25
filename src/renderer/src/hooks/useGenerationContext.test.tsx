import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { modelNodeFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { installDocuments } from '@/stores/document-fixtures'
import { installScene } from '@/stores/scene-fixtures'
import { useLayouts } from '@/stores/layouts'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useSelection } from '@/stores/selection'
import type { GenerationInput, WithdrawableInput } from '@/generation/generationInputs'
import { useGenerationContext } from './useGenerationContext'

const DOCUMENT = 'doc-3d'

/** Two placements of one model, so the id of the ROW cannot stand in for either of them. */
function twoPlacements(): void {
  installScene(DOCUMENT, {
    ...EMPTY_SCENE,
    nodes: [modelNodeFixture('node-a', 'asset-robot'), modelNodeFixture('node-b', 'asset-robot')],
    selectedIds: ['node-a', 'node-b'],
  })
  installDocuments({ [DOCUMENT]: '3d' }, DOCUMENT)
  useLayouts.setState({ activeWorkspace: '3d' })
}

/** The scene's own inputs, narrowed — a placement is the only origin carrying one. */
const scenes = (inputs: readonly GenerationInput[]): WithdrawableInput[] =>
  inputs.flatMap(input => (input.origin === 'scene' ? [input] : []))

// The document stores are emptied by the setup, for every case of every suite.
beforeEach(() => useSelection.getState().clear())

describe('taking a source back off', () => {
  /**
   * 🛑 The placement, never the row. Two nodes referencing one model are two sources, so
   * deselecting by asset id would take both off at once — and the shelf's own pick with them,
   * back when this went through the global selection.
   */
  it('deselects the very placement a scene source was picked as', () => {
    twoPlacements()
    const { result } = renderHook(() => useGenerationContext(null))

    // Two rows for one model, and that is the point: each placement is its own source.
    expect(result.current.inputs).toHaveLength(2)

    const first = scenes(result.current.inputs).find(input => input.nodeId === 'node-a')
    act(() => result.current.withdraw(first!))

    expect(sceneOf(useScenes.getState(), DOCUMENT).selectedIds).toEqual(['node-b'])
  })

  // The shelf keeps what it had: the two selections used to share one descriptor, so withdrawing
  // a mesh wiped every asset source beside it.
  it('leaves what the shelf had picked alone', () => {
    twoPlacements()
    useSelection.getState().selectAssets(['asset-picked'])
    const { result } = renderHook(() => useGenerationContext(null))

    act(() => result.current.withdraw(scenes(result.current.inputs)[0]!))

    expect(useSelection.getState().selection).toMatchObject({ ids: ['asset-picked'] })
  })
})
