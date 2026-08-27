import type { Scenario } from './run'
import * as read from './oracle'
import { cubeScene, playedScene as played } from './setups'

/** 🛑 The load reads the ANSWER: a swap happens inside a game the bench never draws. */
export const SCENES_SCENARIOS: readonly Scenario[] = [
  {
    name: '64.1 sends the running game to another scene',
    said: ['Envoie la partie dans la scène Scène 1.'],
    setup: played,
    passed: run => (read.answerOf(run, 'play.loadScene') ?? '').includes('Scène 1'),
  },
  {
    name: '64.2 cues a fade that goes to another scene',
    said: ['À deux secondes, fais un fondu d’une seconde vers Scène 1.'],
    setup: cubeScene,
    passed: run =>
      (read.animation(run)?.transitions ?? []).some(one => (one.scene ?? '').length > 0),
  },
]
