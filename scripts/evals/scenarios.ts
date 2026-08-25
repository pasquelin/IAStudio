import type { Scenario } from './run'
import { PROJECT_SCENARIOS } from './scenariosProject'
import { SCENE_SCENARIOS } from './scenariosScene'
import { MONTAGE_SCENARIOS } from './scenariosMontage'
import { IMAGE_SCENARIOS } from './scenariosImage'
import { GENERATION_SCENARIOS } from './scenariosGeneration'
import { LANGUAGE_SCENARIOS } from './scenariosLanguage'
import { PLANNING_SCENARIOS } from './scenariosPlanning'
import { SKY_SCENARIOS } from './scenariosSky'
import { CANVAS_SCENARIOS } from './scenariosCanvas'
import { REST_SCENARIOS } from './scenariosRest'
import { SHELL_SCENARIOS } from './scenariosShell'
import { GIT_SCENARIOS } from './scenariosGit'

/**
 * The batterie, as something the bench can run — one scenario per request of `BATTERIE.md`, in
 * its order. `batterie.test.ts` holds the two lists at the same length and in the same order,
 * which is the only thing that makes « on en est où ? » answerable.
 */
export const SCENARIOS: readonly Scenario[] = [
  ...PROJECT_SCENARIOS,
  ...SCENE_SCENARIOS,
  ...MONTAGE_SCENARIOS,
  ...IMAGE_SCENARIOS,
  ...GENERATION_SCENARIOS,
  ...LANGUAGE_SCENARIOS,
  ...PLANNING_SCENARIOS,
  ...SKY_SCENARIOS,
  ...CANVAS_SCENARIOS,
  ...REST_SCENARIOS,
  ...SHELL_SCENARIOS,
  ...GIT_SCENARIOS,
]
