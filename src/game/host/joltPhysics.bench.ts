// SPDX-License-Identifier: MIT

import { bench, describe } from 'vitest'
import { BENCH_SCENES, CHARACTER_SCENE, loadScene } from '../physics/benchScenes'
import { loadJoltPhysics } from './joltPhysics'

/**
 * What a frame of physics costs under Jolt, on the four reference scenes and nothing else — the
 * same objects the Rapier bench reads, so the two columns answer one question.
 *
 * 🛑 The awake count is in the name of every case, and it is half the measure: an engine that
 * puts bodies to sleep sooner reads faster for a reason that has nothing to do with its solver.
 * The switch reads BOTH columns or neither.
 *
 * Memory is NOT read here — a bench is where a leak hides. `joltPhysics.test.ts` holds it, by
 * asking the WebAssembly heap to be exactly where it was a thousand steps earlier.
 */
describe('one step of physics, as Jolt fills it', async () => {
  for (const scene of [...BENCH_SCENES, CHARACTER_SCENE]) {
    const run = await loadScene(scene, loadJoltPhysics)
    bench(`${scene.name} — ${run.awake()} awake`, () => {
      run.frame()
    })
  }
})
