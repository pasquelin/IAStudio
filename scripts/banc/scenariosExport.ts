import type { Scenario } from './run'
import * as read from './oracle'
import { cubeScene } from './setups'

/** 🛑 Read off the DISK the fake port writes onto: an answer alone would score a refusal. */
export const EXPORT_SCENARIOS: readonly Scenario[] = [
  {
    name: '65.1 writes the game out of the studio',
    said: ['Exporte le jeu.'],
    setup: cubeScene,
    passed: run => read.files(run).some(path => path.endsWith('/index.html')),
  },
]
