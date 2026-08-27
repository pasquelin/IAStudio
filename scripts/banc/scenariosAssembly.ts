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
    /** 🛑 What fills `game.prefabs`, which `ref.ts` names as the resolver and nothing wrote. */
    name: '63.3 names the open scene as a prefab',
    said: ['Appelle cette scène un prefab nommé Caisse.'],
    setup: scene(),
    // The DOCUMENT as well as the name: a model that hallucinated one would otherwise score.
    passed: run =>
      run.studio.game().prefabs.some(one => one.name === 'Caisse' && one.document.length > 0),
  },
  {
    /** The front document as well as the barrel: OPENING the prefab would leave both readable. */
    name: '63.4 instances the Scène 1 prefab into the open scene',
    said: ['Pose le prefab Scène 1 dans cette scène.'],
    setup: scene(),
    passed: run =>
      read.front(run)?.title === 'Test MCP' && read.nodeNamed(run, 'BarrelLid') !== undefined,
  },
  {
    /** The front document as well, like 63.4: opening the prefab and dragging its barrel scores. */
    name: '63.5 instances it three metres to the right',
    said: ['Pose le prefab Scène 1 à trois mètres sur la droite.'],
    setup: scene(),
    passed: run =>
      read.front(run)?.title === 'Test MCP' &&
      read.nodeNamed(run, 'Barrel')?.transform.position.x === 3,
  },
]
