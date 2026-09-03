import { stableKey } from '@shared/hash'
import {
  compareVisualFrames,
  type VisualFrame,
  type VisualRegressionOptions,
  type VisualRegressionResult,
} from './visualRegression'

export const SAFE_FUNCTIONAL_CHECKS = [
  'picking',
  'animation',
  'timeline',
  'scripts',
  'physics',
  'shadows',
  'cameras',
  'visibility',
  'postProcessing',
  'transforms',
  'duplication',
  'undoRedo',
] satisfies readonly string[]

export type SafeFunctionalCheck = (typeof SAFE_FUNCTIONAL_CHECKS)[number]
export type SafeRuntimeSnapshot = Record<SafeFunctionalCheck, unknown>
export type SafeValidationCamera = { id: string }
export type SafeFunctionalResult = { check: SafeFunctionalCheck; equivalent: boolean }
export type SafeVisualResult = VisualRegressionResult & { cameraId: string }
export type SafeRuntimeValidationReport = {
  visual: readonly SafeVisualResult[]
  functional: readonly SafeFunctionalResult[]
  equivalent: boolean
}

export type SafeRuntimeValidationInput = {
  cameras: readonly SafeValidationCamera[]
  renderOriginal: (camera: SafeValidationCamera) => Promise<VisualFrame>
  renderOptimized: (camera: SafeValidationCamera) => Promise<VisualFrame>
  observeOriginal: () => Promise<SafeRuntimeSnapshot>
  observeOptimized: () => Promise<SafeRuntimeSnapshot>
  visualOptions: VisualRegressionOptions
}

export async function validateSafeRuntime(
  input: SafeRuntimeValidationInput,
): Promise<SafeRuntimeValidationReport> {
  if (input.cameras.length === 0) throw new Error('SAFE validation requires at least one camera')
  const visual: SafeVisualResult[] = []
  for (const camera of input.cameras) {
    visual.push({
      cameraId: camera.id,
      ...compareVisualFrames(
        await input.renderOriginal(camera),
        await input.renderOptimized(camera),
        input.visualOptions,
      ),
    })
  }

  const original = await input.observeOriginal()
  const optimized = await input.observeOptimized()
  const functional = SAFE_FUNCTIONAL_CHECKS.map(check => ({
    check,
    equivalent: stableKey(original[check]) === stableKey(optimized[check]),
  }))
  return {
    visual,
    functional,
    equivalent:
      visual.every(result => result.equivalent) && functional.every(result => result.equivalent),
  }
}
