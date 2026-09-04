import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { OptimizationPlan } from '@/engines/scene/worldAnalyzer'
import { installDocument } from '@/stores/document-fixtures'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { useGameExportDialog } from '@/hooks/useGameExportDialog'
import { SceneGameExportDialog } from './SceneGameExportDialog'

const { runAction } = vi.hoisted(() => ({ runAction: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/features/assistant/executor', () => ({ runAction }))

const DOCUMENT = 'Forest'
const PLAN: OptimizationPlan = {
  classifications: [],
  instances: [],
  bakeCandidates: [],
  batches: [],
  warnings: [],
  measured: {
    triangles: 100,
    vertices: 200,
    draws: 20,
    textureBytes: 0,
    objects: 20,
    visibleObjects: 20,
    meshes: 20,
    geometryBytes: 1024,
    sharedMaterials: 1,
  },
  estimated: {
    drawCallsBefore: 20,
    drawCallsAfter: 2,
    avoidedGeometryBytes: 0,
    avoidedTextureBytes: 0,
  },
}

beforeEach(() => {
  installDocument(DOCUMENT, '3d')
  registerSceneEngine(DOCUMENT, {
    analyzeWorldOptimization: async () => PLAN,
  } as unknown as SceneRenderer)
  useGameExportDialog.getState().open(DOCUMENT)
  runAction.mockClear()
})

afterEach(() => {
  forgetSceneEngine(DOCUMENT)
  useGameExportDialog.getState().close()
})

it('keeps visual changes off until the user enables a lossy export choice', async () => {
  const user = userEvent.setup()
  render(<SceneGameExportDialog documentId={DOCUMENT} />)

  expect(await screen.findByText(/Changements visuels.*AUCUN/)).toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: 'Générer les niveaux de distance' }))
  expect(screen.getByText(/Changements visuels.*POSSIBLES/)).toBeInTheDocument()
})

it('exports through the shared game action with the explicit choices', async () => {
  const user = userEvent.setup()
  render(<SceneGameExportDialog documentId={DOCUMENT} />)

  await screen.findByText('Appels de rendu 20 → 2')
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Simplification géométrique' }),
    'balanced',
  )
  await user.click(screen.getByRole('button', { name: 'Exporter' }))

  expect(runAction).toHaveBeenCalledWith('game.export', {
    entryScene: DOCUMENT,
    generateLods: false,
    geometrySimplification: 'balanced',
    textureCompression: 'off',
    textureReduction: 'off',
  })
})
