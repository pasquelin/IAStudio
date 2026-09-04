import { evaluate } from './cdp.mjs'

const result = await evaluate(
  `(async () => {
    await import('/src/engines/scene/worldSafeValidation.browser.ts')
    const validate = Reflect.get(window, '__iaValidateWorldBenchmarks')
    if (typeof validate !== 'function') throw new Error('le harnais SAFE WebGL est absent')
    return await validate()
  })()`,
  { timeout: 180_000 },
)

console.log(JSON.stringify(result, null, 2))

const EXPECTED_SCENES = ['S1', 'S2', 'S3', 'S4', 'S5']
if (
  !Array.isArray(result) ||
  result.map(entry => entry.id).join(',') !== EXPECTED_SCENES.join(',') ||
  result.some(
    entry =>
      entry.equivalent !== true ||
      entry.nonUniformFrames !== entry.cameraCount * 2 ||
      entry.observedPickSamples === 0 ||
      (entry.id === 'S5' &&
        (entry.executedScriptHooks === 0 ||
          entry.successfulScriptEffects === 0 ||
          entry.scriptFaults !== 0 ||
          entry.simulatedPhysicsBodies === 0 ||
          entry.simulatedPhysicsSteps === 0 ||
          entry.simulatedPhysicsEffects === 0 ||
          entry.executedTimelineActions === 0 ||
          entry.successfulDuplications === 0 ||
          entry.successfulUndoRedo === 0)),
  )
) {
  throw new Error('la validation SAFE S1–S5 a détecté une différence')
}
