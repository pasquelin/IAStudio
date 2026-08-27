import type { Scenario } from './run'
import * as read from './oracle'
import { cubeScene } from './setups'

/**
 * Section 61: the loop the whole MCP lot exists for — start, read what went wrong, repair, start
 * again. What each case asserts is the STUDIO's own state, never the fact that a call was made.
 */

/** A scene with a cube, played and paused: the state every reading below is taken in. */
const paused = async (studio: Parameters<typeof cubeScene>[0]): Promise<void> => {
  await cubeScene(studio)
  await studio.run('play.start', {})
  await studio.run('play.pause', {})
}

export const PLAY_SCENARIOS: readonly Scenario[] = [
  {
    name: '61.1 starts the game',
    said: ['Lance la partie.'],
    setup: cubeScene,
    passed: run => read.answeredBy(run, 'play.start') !== undefined,
  },
  {
    name: '61.2 says where the game is',
    said: ['Où en est la partie ?'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('play.start', {})
    },
    passed: run => read.answeredBy(run, 'runtime.report') !== undefined,
  },
  {
    name: '61.3 pauses the game',
    said: ['Mets la partie en pause.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('play.start', {})
    },
    passed: run => read.answeredBy(run, 'play.pause') !== undefined,
  },
  {
    name: '61.4 steps a paused game ten fixed steps',
    said: ['Avance de dix pas.'],
    setup: paused,
    passed: run => read.answeredBy(run, 'play.step') !== undefined,
  },
  {
    name: '61.5 resumes the game',
    said: ['Reprends la partie.'],
    setup: paused,
    passed: run => read.answeredBy(run, 'play.resume') !== undefined,
  },
  {
    name: '61.6 reads what went wrong',
    said: ['Y a-t-il des erreurs dans la partie ?'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('play.start', {})
    },
    passed: run => read.answeredBy(run, 'runtime.errors') !== undefined,
  },
  {
    name: '61.7 stops the game',
    said: ['Arrête la partie.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('play.start', {})
    },
    passed: run => read.answeredBy(run, 'play.stop') !== undefined,
  },
  {
    name: '61.8 lists the scripts of the project',
    said: ['Quels scripts ce projet contient-il ?'],
    setup: cubeScene,
    passed: run => read.answeredBy(run, 'script.list') !== undefined,
  },
  {
    name: '61.9 reads one script back',
    said: ['Montre-moi le script Walk.ts.'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('script.write', {
        path: 'Walk.ts',
        source: 'export default defineScript({ onUpdate() {} })',
      })
    },
    passed: run => read.answeredBy(run, 'script.read') !== undefined,
  },
  {
    name: '61.10 writes a script into the project',
    said: ['Écris un script Patrol.ts qui fait avancer l’objet.'],
    setup: cubeScene,
    passed: run => read.answeredBy(run, 'script.write') !== undefined,
  },
  {
    name: '61.11 describes what is in front',
    said: ['Décris-moi Cube Test.'],
    setup: cubeScene,
    passed: run => read.answeredBy(run, 'studio.describe') !== undefined,
  },
  {
    name: '61.12 serves the documentation of one component',
    said: ['Qu’est-ce que je peux régler sur un composant Santé ?'],
    setup: cubeScene,
    passed: run => read.answeredBy(run, 'studio.docs') !== undefined,
  },
  {
    name: '61.13 runs a lot of calls as one',
    said: ['Donne de la santé à Cube Test et monte son maximum à 250, en une seule fois.'],
    setup: cubeScene,
    passed: run =>
      read.nodeNamed(run, 'Cube Test')?.components?.find(one => one.type === 'Health')?.max === 250,
  },
]
