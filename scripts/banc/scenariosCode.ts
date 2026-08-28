import { CODE_SOURCE_FIELD } from '@shared/domain/codeGeneration'
import type { Scenario } from './run'
import * as read from './oracle'
import { cubeScene } from './setups'

/**
 * Section 66: having a MODEL write the script, where section 61 has the assistant write one
 * itself through `script.write`.
 *
 * 🛑 What is scored is the family the generation ran under — a script written by hand would pass
 * an oracle that only asked whether a `.ts` appeared on the disk.
 */
export const CODE_SCENARIOS: readonly Scenario[] = [
  {
    name: '66.1 has a model write a script from a description',
    said: ['Fais écrire par un modèle un script qui fait tourner l’objet.'],
    setup: cubeScene,
    passed: run => read.generated(run, 'code'),
  },
  {
    name: '66.2 has a model rewrite the script in front',
    said: ['Demande au modèle de réécrire ce script pour qu’il aille deux fois plus vite.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('script.write', {
        path: 'Walk.ts',
        source: 'export default defineScript({ props: { speed: 4 }, onUpdate() {} })',
      })
      await studio.run('file.open', { path: 'Walk.ts' })
    },
    // 🛑 The script AT HAND was sent: without this the case passed whether or not the open script
    // reached the model, which is the whole of what « réécris CE script » means.
    passed: run => read.generated(run, 'code') && read.sentWith(run, 'code', CODE_SOURCE_FIELD),
  },
  {
    name: '66.3 says what is armed before spending anything',
    said: ['Avant de dépenser quoi que ce soit, dis-moi ce qui est armé dans le générateur.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('generator.prepare', {
        family: 'code',
        modelId: 'model-code',
        parameters: { prompt: 'a spin' },
      })
    },
    // Read and said, and NOTHING else: the question exists so a client can see the destination
    // before the spend, and an answer paid for is not an answer.
    passed: run =>
      read.answeredWith(run, 'generator.armed') && read.spoke(run) && read.lookedOnly(run),
  },
  {
    name: '66.4 writes a new script without touching the one in front',
    said: ['Fais écrire un nouveau script de saut, sans toucher à celui qui est ouvert.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('script.write', {
        path: 'Walk.ts',
        source: 'export default defineScript({ props: { speed: 4 }, onUpdate() {} })',
      })
      await studio.run('file.open', { path: 'Walk.ts' })
    },
    /**
     * 🛑 The open script must NOT have travelled: a `txt2code` that carried it had the model
     * rework it while the answer landed in a new file — the two decisions at odds.
     */
    passed: run => read.generated(run, 'code') && !read.sentWith(run, 'code', CODE_SOURCE_FIELD),
  },
]
