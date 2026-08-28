import type { Studio } from './studio'
import type { Scenario } from './run'
import * as read from './oracle'
import { cubeScene } from './setups'

/**
 * Section 67: what the assistant has LEARNED about this project, read and written from outside.
 *
 * 🛑 The two reading requests are scored on what the action ANSWERED and on the model having
 * said something — a read changes nothing, so there is no state to look at. Every other oracle
 * here reads the real store, which `memoryStore.ts` puts behind the bridge.
 */

const RAIL = 'Les caméras suivent le rail, jamais la cible.'

/** A studio that has already learned one thing, so a recall has something to find. */
const knowsTheRail = async (studio: Studio): Promise<void> => {
  await cubeScene(studio)
  await studio.run('memory.write', {
    type: 'decision',
    summary: RAIL,
    importance: 4,
    file: 'Scripts/CameraRig.ts',
  })
}

const aboutTheRail = (studio: Studio): boolean =>
  studio.memories().some(one => one.state === 'live' && /rail/i.test(one.summary))

export const MEMORY_SCENARIOS: readonly Scenario[] = [
  {
    name: '67.1 remembers something the person states about the project',
    said: ['Retiens que les caméras suivent le rail, jamais la cible.'],
    setup: cubeScene,
    passed: run => aboutTheRail(run.studio),
  },
  {
    name: '67.2 answers from what it has already learned',
    said: ['Qu’est-ce que tu sais des caméras de ce projet ?'],
    setup: knowsTheRail,
    passed: run => read.answeredWith(run, 'memory.recall') && read.spoke(run),
  },
  {
    name: '67.3 reads one memory whole rather than its summary',
    said: ['Donne-moi le détail de ce que tu sais sur les caméras.'],
    setup: knowsTheRail,
    passed: run => read.answeredWith(run, 'memory.read') && read.spoke(run),
  },
  {
    name: '67.4 forgets what it learned about the cameras',
    said: ['Oublie ce que tu as retenu sur les caméras.'],
    setup: knowsTheRail,
    passed: run => !aboutTheRail(run.studio),
  },
  {
    name: '67.5 links one memory to another',
    said: ['Relie ce que tu sais des caméras à ce que tu sais du script.'],
    setup: async studio => {
      await knowsTheRail(studio)
      await studio.run('memory.write', {
        type: 'script',
        summary: 'Scripts/CameraRig.ts pilote le rail principal.',
        importance: 3,
      })
    },
    passed: run => run.studio.memories().some(one => one.links.length > 0),
  },
]
