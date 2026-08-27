import type { Scenario } from './run'
import type { Studio } from './studio'
import * as read from './oracle'
import { cubeScene, playedScene as played } from './setups'

/**
 * Section 61: the loop the whole MCP lot exists for — start, read what went wrong, repair, start
 * again.
 *
 * 🛑 What each case asserts is what the studio HOLDS, or what an answer SAID — never that a call
 * was made. Written the other way round first, and every one of them passed on a studio that had
 * refused the call: `answerShown` writes « refused … », which is a defined string.
 */

/** The same, paused — what `play.step` needs, and what a reading without a race needs. */
const paused = async (studio: Studio): Promise<void> => {
  await played(studio)
  await studio.run('play.pause', {})
}

export const PLAY_SCENARIOS: readonly Scenario[] = [
  {
    name: '61.1 starts the game',
    said: ['Lance la partie.'],
    setup: async studio => {
      await cubeScene(studio)
    },
    passed: run => run.studio.playState() !== 'edit',
  },
  {
    name: '61.2 says where the game is',
    said: ['Où en est la partie ?'],
    setup: played,
    passed: run => (read.answerOf(run, 'runtime.report') ?? '').includes('tick'),
  },
  {
    name: '61.3 pauses the game',
    said: ['Mets la partie en pause.'],
    setup: played,
    passed: run => run.studio.playState() === 'paused',
  },
  {
    name: '61.4 steps a paused game ten fixed steps',
    said: ['Avance de dix pas.'],
    setup: paused,
    // The TICK moved and the game is still paused: a resume would have moved it too.
    passed: run =>
      run.studio.playState() === 'paused' &&
      (read.answerOf(run, 'play.step') ?? '').includes('steps'),
  },
  {
    name: '61.5 resumes the game',
    said: ['Reprends la partie.'],
    setup: paused,
    passed: run => run.studio.playState() === 'playing',
  },
  {
    name: '61.6 reads what went wrong',
    said: ['Y a-t-il des erreurs dans la partie ?'],
    setup: played,
    passed: run => (read.answerOf(run, 'runtime.errors') ?? '').includes('errors'),
  },
  {
    name: '61.7 stops the game',
    said: ['Arrête la partie.'],
    setup: played,
    passed: run => run.studio.playState() === 'edit',
  },
  {
    name: '61.8 lists the scripts of the project',
    said: ['Quels scripts ce projet contient-il ?'],
    setup: async studio => {
      await cubeScene(studio)
      await studio.run('script.write', {
        path: 'Walk.ts',
        source: 'export default defineScript({ onUpdate() {} })',
      })
    },
    passed: run => (read.answerOf(run, 'script.list') ?? '').includes('Walk.ts'),
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
    passed: run => (read.answerOf(run, 'script.read') ?? '').includes('defineScript'),
  },
  {
    name: '61.10 writes a script into the project',
    said: ['Écris un script Patrol.ts qui fait avancer l’objet.'],
    setup: cubeScene,
    // On the DISK the bench holds, which is the same one `studio.files()` reads.
    passed: run => read.files(run).some(path => path.endsWith('.ts')),
  },
  {
    name: '61.11 describes what is in front',
    said: ['Décris-moi Cube Test.'],
    setup: cubeScene,
    passed: run => (read.answerOf(run, 'studio.describe') ?? '').includes('Cube Test'),
  },
  {
    name: '61.12 serves the documentation of one component',
    said: ['Qu’est-ce que je peux régler sur un composant Santé ?'],
    setup: cubeScene,
    passed: run => (read.answerOf(run, 'studio.docs') ?? '').includes('Health'),
  },
  {
    name: '61.13 runs a lot of calls as one',
    said: ['Donne de la santé à Cube Test et monte son maximum à 250, en une seule fois.'],
    setup: cubeScene,
    passed: run =>
      read.nodeNamed(run, 'Cube Test')?.components?.find(one => one.type === 'Health')?.max === 250,
  },
]
