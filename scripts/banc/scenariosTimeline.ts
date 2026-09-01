import type { Scenario } from './run'
import * as read from './oracle'
import { cubeScene } from './setups'

/**
 * Section 62: what a timeline CUES, as opposed to what it moves.
 *
 * Read off the document rather than off the call: a row written and then written back by a
 * second call would pass a check that only counted calls.
 */
export const TIMELINE_SCENARIOS: readonly Scenario[] = [
  {
    name: '62.1 cues an event two seconds in',
    said: ['Fais s’ouvrir la porte à deux secondes de cinématique.'],
    setup: cubeScene,
    passed: run => (read.animation(run)?.events?.length ?? 0) > 0,
  },
  {
    name: '62.2 lays a one-second fade three seconds in',
    said: ['Mets un fondu d’une seconde à trois secondes.'],
    setup: cubeScene,
    passed: run => (read.animation(run)?.transitions ?? []).some(one => one.kind === 'fade'),
  },
  {
    name: '62.3 takes the fade back off',
    said: ['Retire le fondu que tu viens de poser.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('timeline.addSceneCue', {
        list: 'transitions',
        at: 0,
        what: 'fade',
        duration: 1,
      })
    },
    passed: run => (read.animation(run)?.transitions ?? []).length === 0,
  },
  {
    name: '62.4 says what the panel should offer',
    said: ['Cette timeline est une intro : ne me propose que ce qu’il faut.'],
    setup: cubeScene,
    passed: run => read.animation(run)?.template === 'intro',
  },
]
