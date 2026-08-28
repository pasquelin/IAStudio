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
]
