import type { Run, Scenario } from './run'
import * as read from './oracle'
import { cubeScene } from './setups'

/**
 * Section 59: what an object DOES while the game runs, as opposed to what it draws.
 *
 * Read off the node rather than off the call: a component written and then written back by a
 * second call would pass a check that only counted calls.
 */
const componentOf = (run: Run, name: string, type: string): Record<string, unknown> | undefined =>
  read.nodeNamed(run, name)?.components?.find(component => component.type === type)

export const GAME_SCENARIOS: readonly Scenario[] = [
  {
    name: '59.1 gives Cube Test some health',
    said: ['Donne de la santé à Cube Test.'],
    setup: cubeScene,
    passed: run => componentOf(run, 'Cube Test', 'Health') !== undefined,
  },
  {
    name: '59.2 raises its maximum health to 250',
    said: ['Monte la santé maximum de Cube Test à 250.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('component.attach', { nodeId: 'Cube Test', type: 'Health' })
    },
    passed: run => componentOf(run, 'Cube Test', 'Health')?.max === 250,
  },
  {
    name: '59.3 makes it travel up and down',
    said: ['Fais monter et descendre Cube Test.'],
    setup: cubeScene,
    passed: run => componentOf(run, 'Cube Test', 'Movement')?.axis === 'y',
  },
  {
    name: '59.4 takes its health back off',
    said: ['Retire la santé de Cube Test.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('component.attach', { nodeId: 'Cube Test', type: 'Health' })
    },
    passed: run => componentOf(run, 'Cube Test', 'Health') === undefined,
  },
]
