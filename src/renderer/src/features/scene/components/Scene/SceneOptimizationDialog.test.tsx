import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { EMPTY_SCENE, nodeById, type SceneNode } from '@/engines/scene/sceneState'
import { groupNodeFixture, meshNode } from '@/engines/scene/scene-fixtures'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { OptimizationPlan } from '@/engines/scene/worldAnalyzer'
import { clearScenes, installScene } from '@/stores/scene-fixtures'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useOptimizationDialog } from '@/hooks/useOptimizationDialog'
import { runSceneCommand } from '../sceneCommands'
import { SceneOptimizationDialog } from './SceneOptimizationDialog'

const DOCUMENT = 'optimization-document'
const PLAN: OptimizationPlan = {
  classifications: [],
  instances: [],
  batches: [{ key: 'paint', sourceIds: ['group', 'child'], meshCount: 2 }],
  warnings: [],
  measured: {
    triangles: 12,
    vertices: 24,
    draws: 2,
    textureBytes: 0,
    objects: 2,
    meshes: 1,
    geometryBytes: 96,
    sharedMaterials: 0,
  },
  estimated: {
    drawCallsBefore: 2,
    drawCallsAfter: 2,
    avoidedGeometryBytes: 0,
    avoidedTextureBytes: 0,
  },
}

beforeEach(() => {
  clearScenes()
  const group: SceneNode = { ...groupNodeFixture('group'), optimization: { mode: 'exclude' } }
  const child: SceneNode = {
    ...meshNode('child', group.id),
    optimization: { mode: 'exclude' },
  }
  installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [group, child], selectedIds: [group.id] })
  // Only the public analyzer is relevant; constructing WebGL would make this DOM test browser-only.
  registerSceneEngine(DOCUMENT, { analyzeOptimization: () => PLAN } as unknown as SceneRenderer)
  useOptimizationDialog.getState().open({ documentId: DOCUMENT, selectedIds: [group.id] })
})

afterEach(() => {
  forgetSceneEngine(DOCUMENT)
  useOptimizationDialog.getState().close()
})

it('shows the current override and applies Auto to the whole selected subtree as one undo', async () => {
  const user = userEvent.setup()
  render(<SceneOptimizationDialog documentId={DOCUMENT} />)

  expect(screen.getByRole('combobox')).toHaveValue('exclude')
  expect(screen.getByText('Appels de rendu 2 → 2')).toBeInTheDocument()
  await user.selectOptions(screen.getByRole('combobox'), 'auto')
  expect(screen.getByText('Appels de rendu 2 → 2')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Optimiser' }))

  const changed = sceneOf(useScenes.getState(), DOCUMENT)
  expect(nodeById(changed, 'group')?.optimization).toBeUndefined()
  expect(nodeById(changed, 'child')?.optimization).toBeUndefined()

  runSceneCommand(DOCUMENT, 'scene.undo')
  const restored = sceneOf(useScenes.getState(), DOCUMENT)
  expect(nodeById(restored, 'group')?.optimization?.mode).toBe('exclude')
  expect(nodeById(restored, 'child')?.optimization?.mode).toBe('exclude')
})

it('does not erase mixed overrides until a mode is explicitly chosen', () => {
  const first: SceneNode = { ...meshNode('first'), optimization: { mode: 'exclude' } }
  const second: SceneNode = { ...meshNode('second'), optimization: { mode: 'individual' } }
  installScene(DOCUMENT, {
    ...EMPTY_SCENE,
    nodes: [first, second],
    selectedIds: [first.id, second.id],
  })
  useOptimizationDialog.getState().open({
    documentId: DOCUMENT,
    selectedIds: [first.id, second.id],
  })

  render(<SceneOptimizationDialog documentId={DOCUMENT} />)

  expect(screen.getByRole('combobox')).toHaveValue('mixed')
  expect(screen.getByRole('button', { name: 'Optimiser' })).toBeDisabled()
})

it('offers the batch override and applies it to the selected subtree', async () => {
  const user = userEvent.setup()
  render(<SceneOptimizationDialog documentId={DOCUMENT} />)

  await user.selectOptions(screen.getByRole('combobox'), 'batch')
  expect(screen.getByText('Appels de rendu 2 → 1')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Optimiser' }))

  expect(nodeById(sceneOf(useScenes.getState(), DOCUMENT), 'child')?.optimization?.mode).toBe(
    'batch',
  )
})
