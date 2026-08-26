import type { Scenario } from './run'
import type { Studio } from './studio'
import * as read from './oracle'
import { named, scene } from './setups'

/**
 * The composition, asked for in words.
 *
 * 🛑 Every decor here opens an EMPTY scene and then puts what the request talks about into it —
 * the two guards of `batterie.test.ts` are what this file answers to: no decor may set itself up
 * with a refusal, and no scenario may pass by doing nothing. A scene opens with no effect at
 * all, so « ajoute un bloom » is a real change and « enlève-le » needs one put there first.
 */

const composing = async (studio: Studio): Promise<void> => {
  await scene()(studio)
  await studio.run('post.add', { effect: 'bloom' })
}

const withCamera = async (studio: Studio): Promise<void> => {
  await scene()(studio)
  await studio.run('node.add', { kind: 'camera', name: 'Camera 01' })
}

export const POST_SCENARIOS: readonly Scenario[] = [
  {
    name: '59.1 says what the scene composes with',
    said: ['Quels effets de post-traitement porte cette scène ?'],
    setup: composing,
    passed: run => read.spoke(run) && read.answeredWith(run, 'post.state'),
  },
  {
    name: '59.2 adds a bloom to the scene',
    said: ['Ajoute un halo lumineux au post-traitement de la scène.'],
    setup: scene(),
    passed: run => read.composes(run, 'bloom'),
  },
  {
    name: '59.3 sets the strength of the bloom to 1.5',
    said: ['Monte la force du halo lumineux à 1,5.'],
    setup: composing,
    passed: run => read.near(read.postParam(run, 'bloom', 'strength') ?? 0, 1.5, 0.01),
  },
  {
    name: '59.4 switches the bloom off without removing it',
    said: ['Désactive le halo lumineux sans le retirer.'],
    setup: composing,
    passed: run => read.composes(run, 'bloom') && read.post(run).effects.every(one => !one.enabled),
  },
  {
    name: '59.5 removes the bloom from the composition',
    said: ['Retire le halo lumineux de la composition.'],
    setup: composing,
    passed: run => !read.composes(run, 'bloom'),
  },
  {
    name: '59.6 applies the cinematic preset to the scene',
    said: ['Applique le préréglage cinéma au post-traitement de la scène.'],
    setup: scene(),
    passed: run => read.composes(run, 'gtao') && read.composes(run, 'vignette'),
  },
  {
    name: '59.7 turns the whole composition off',
    said: ['Coupe tout le post-traitement de la scène pour comparer.'],
    setup: composing,
    passed: run => !read.post(run).enabled,
  },
  {
    name: '59.8 moves an effect earlier in the chain',
    said: ['Fais passer le vignettage avant le halo lumineux.'],
    setup: async studio => {
      await composing(studio)
      await studio.run('post.add', { effect: 'vignette' })
    },
    passed: run => {
      const order = read.post(run).effects.map(one => one.effect)
      return order.indexOf('vignette') < order.indexOf('bloom')
    },
  },
  {
    name: '59.9 gives a camera a composition of its own',
    said: ['Donne à Camera 01 son propre post-traitement, indépendant de la scène.'],
    setup: withCamera,
    passed: run => read.cameraPostMode(run, 'Camera 01') === 'override',
  },
  {
    name: '59.10 stops a camera composing at all',
    said: ['Rends Camera 01 sans aucun post-traitement.'],
    setup: withCamera,
    passed: run => read.cameraPostMode(run, 'Camera 01') === 'disabled',
  },
  {
    name: '59.11 puts a camera back on the scene composition',
    said: ['Remets Camera 01 sur le post-traitement de la scène.'],
    // Overriding first, or « remets-la sur celui de la scène » asks for what is already true.
    setup: async studio => {
      await withCamera(studio)
      await studio.run('post.camera', { nodeId: named(studio, 'Camera 01'), mode: 'override' })
    },
    passed: run => read.cameraPostMode(run, 'Camera 01') === 'inherit',
  },
  {
    name: '59.12 gives the camera its own look, apart from the scene',
    said: ['Applique le préréglage horreur au post-traitement de Camera 01 seule.'],
    setup: async studio => {
      await withCamera(studio)
      await studio.run('post.camera', { nodeId: named(studio, 'Camera 01'), mode: 'override' })
    },
    passed: run =>
      (read.cameraPost(run, 'Camera 01')?.effects.length ?? 0) > 0 &&
      read.post(run).effects.length === 0,
  },
]
