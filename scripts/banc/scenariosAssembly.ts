import type { Scenario } from './run'
import * as read from './oracle'
import { scene } from './setups'

/**
 * 🛑 The decor is an EMPTY scene, which is what makes these measurable: `basic` seeds a floor and
 * a camera, so a scenario reading the camera off it would score a model that did nothing.
 */
export const ASSEMBLY_SCENARIOS: readonly Scenario[] = [
  {
    name: '63.1 lays out a third-person game',
    said: ['Fais-moi un jeu à la troisième personne.'],
    setup: scene(),
    passed: run =>
      read.world(run)?.play.camera === 'thirdPerson' &&
      read
        .nodes(run)
        .some(one => one.components?.some(part => part.type === 'CharacterController')),
  },
  {
    name: '63.2 lays out a top-down game',
    said: ['Fais-moi un jeu vu de dessus.'],
    setup: scene(),
    passed: run => read.world(run)?.play.camera === 'topDown' && read.nodes(run).length > 0,
  },
  {
    /** The front document as well as the barrel: OPENING the prefab would leave both readable. */
    name: '63.3 instances the Scène 1 prefab into the open scene',
    said: ['Pose le prefab Scène 1 dans cette scène.'],
    setup: scene(),
    passed: run =>
      read.front(run)?.title === 'Test MCP' && read.nodeNamed(run, 'BarrelLid') !== undefined,
  },
  {
    /** The front document as well, like 63.3: opening the prefab and dragging its barrel scores. */
    name: '63.4 instances it three metres to the right',
    said: ['Pose le prefab Scène 1 à trois mètres sur la droite.'],
    setup: scene(),
    passed: run =>
      read.front(run)?.title === 'Test MCP' &&
      read.nodeNamed(run, 'Barrel')?.transform.position.x === 3,
  },
]
