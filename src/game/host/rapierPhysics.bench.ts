// SPDX-License-Identifier: MIT

import { bench, describe } from 'vitest'
import { BENCH_SCENES, CHARACTER_SCENE, loadScene } from '../physics/benchScenes'
import { loadRapierPhysics } from './rapierPhysics'

/**
 * What a frame of physics costs under Rapier, on the four reference scenes and nothing else. The
 * budget is 16,7 ms; the scenes and their warmups live in `benchScenes.ts`, shared with the Jolt
 * bench so the two columns are answers to the SAME question.
 *
 * 🛑 The awake count is in the name of every case, and it is half the measure: a pile left alone
 * settles within a few steps, and a bench that timed a sleeping scene under an awake name would
 * read five hundred times too fast.
 *
 * Measured 2026-08-27, before these scenes existed and on a wall of five hundred boxes: 1,06 ms
 * awake, p99 1,31, 0,0019 ms settled, and a walking character 0,0041 ms.
 */
describe('one step of physics, as Rapier fills it', async () => {
  for (const scene of [...BENCH_SCENES, CHARACTER_SCENE]) {
    const run = await loadScene(scene, loadRapierPhysics)
    bench(`${scene.name} — ${run.awake()} awake`, () => {
      run.frame()
    })
  }
})
