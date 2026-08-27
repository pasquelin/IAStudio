import { describe, expect, it } from 'vitest'
import type { AnimationTimeline, TimelineTransition } from '@shared/domain/animation'
import { newComponent } from '@shared/domain/componentRegistry'
import type { LogEntry } from '@shared/domain/gameRuntime'
import { EMPTY_TIMELINE } from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'
import { notedPhysics } from '@game/physics/physics-fixtures'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import { drawnBy, handDriven } from './game-fixtures'
import { startPlay, type SceneLookup } from './playSession'

/** The chain of § 14: each scene cuts to the next one second in, so five run in five seconds. */
const CHAIN = ['Menu', 'Intro', 'World01', 'Cinematic', 'World02']

const goingTo = (scene: string | undefined): AnimationTimeline =>
  scene === undefined
    ? EMPTY_TIMELINE
    : {
        ...EMPTY_TIMELINE,
        transitions: [
          { id: `to-${scene}`, at: SECOND, kind: 'fade', duration: SECOND, scene },
        ] satisfies TimelineTransition[],
      }

/** One SOLID node per scene, named after it: what the entity and the body count are read off. */
const sceneOf = (name: string, next: string | undefined): SceneState => ({
  ...EMPTY_SCENE,
  nodes: [{ ...meshNode(`node-${name}`), name, components: [newComponent('Collider')] }],
  animation: goingTo(next),
})

function chained(lookup?: (scene: string) => SceneLookup) {
  const frames = handDriven()
  const physics = notedPhysics()
  const applied: SceneState[] = []
  const reported: LogEntry[] = []
  const placed: unknown[] = []
  let document = sceneOf('Menu', 'Intro')
  const built = new Map(CHAIN.map((name, at) => [name, sceneOf(name, CHAIN[at + 1])]))

  const session = startPlay({
    documentId: 'doc-1',
    renderer: drawnBy({
      apply: state => void applied.push(state),
      placeView: view => void placed.push(view),
    }),
    // Read per frame and REPLACED by `edit()`, as a click on a node replaces it in the store.
    editState: () => document,
    input: new EventTarget(),
    frames: frames.driver,
    physics,
    sceneNamed:
      lookup ??
      (scene => {
        const state = built.get(scene)
        return state ? { state, document: scene } : 'unknown'
      }),
    onReport: report => reported.push(...report.logs.slice(reported.length)),
  })

  return {
    session,
    frames,
    physics,
    applied,
    placed,
    edit: () => {
      document = { ...document, selectedIds: ['node-Menu'] }
    },
    logs: () => reported.map(one => one.message),
  }
}

/** 🛑 The lot's own criterion: the chain runs, and nothing of a scene outlives it. */
describe('a game walking from scene to scene', () => {
  it('runs Menu → Intro → World01 → Cinematic → World02 on its own', () => {
    const { session, frames } = chained()
    const seen: string[] = []

    for (let at = 0; at < 400; at += 1) {
      frames.run(1, at)
      const name = session.sceneNow().nodes[0]?.name
      if (name && seen.at(-1) !== name) seen.push(name)
    }

    expect(seen).toEqual(CHAIN)
  })

  /** A body left standing under the next scene is the leak this lot exists to make impossible. */
  it('gives every body of a scene back before the next one is built', () => {
    const { frames, physics } = chained()

    frames.run(130)
    const standing = physics.added
      .map(one => one.body)
      .filter(body => !physics.removed.includes(body))

    expect(physics.added.map(one => one.body)).toContain('node-Menu')
    expect(standing).toEqual(['node-Intro'])
  })

  /** A file on its way is not a file the project does not hold. */
  it('waits for a scene still being read rather than giving up on it', () => {
    let answers: SceneLookup = 'reading'
    const { session, frames } = chained(() => answers)

    frames.run(130)
    expect(session.sceneNow().nodes[0]?.name).toBe('Menu')

    answers = { state: sceneOf('World01', undefined), document: 'World01' }
    frames.run(2, 130)
    expect(session.sceneNow().nodes[0]?.name).toBe('World01')
  })

  /** 🛑 Bounded: a read that never answers would hold the port, and every later request with it. */
  it('gives up on a scene that never arrives, and says so', () => {
    const { session, frames, logs } = chained(() => 'reading')

    frames.run(500)

    expect(session.sceneNow().nodes[0]?.name).toBe('Menu')
    expect(logs().some(one => one.includes('taking too long'))).toBe(true)
  })

  it('says so and stays put for a scene the project does not hold', () => {
    const { session, frames, logs } = chained(() => 'unknown')

    frames.run(130)

    expect(session.sceneNow().nodes[0]?.name).toBe('Menu')
    expect(logs().some(one => one.includes('no scene named'))).toBe(true)
  })

  /** A scene naming itself would rebuild a world every other frame, for ever. */
  it('refuses to load the scene it is already playing', () => {
    const { frames, physics, logs } = chained(() => ({
      state: sceneOf('Menu', 'Menu'),
      document: 'doc-1',
    }))

    frames.run(130)

    expect(logs().some(one => one.includes('already the scene'))).toBe(true)
    expect(physics.added.length).toBeLessThan(4)
  })
})

describe('what the viewport is shown after a swap', () => {
  /** 🛑 `studioRender` repaints what MOVED, and on its first frame a scene has moved nothing. */
  it('draws the scene that arrived, even when nothing in it has moved', () => {
    const { frames, applied } = chained()

    frames.run(130)

    expect(applied.at(-1)?.nodes[0]?.name).toBe('Intro')
  })

  /**
   * 🛑 The viewport re-applies the DOCUMENT on any change of it — a click on a node is one — and
   * nothing of a loaded scene changes, so nothing else would ever ask for it back.
   */
  it('draws the loaded scene again when the document under it is edited', () => {
    const { frames, applied, edit } = chained()

    frames.run(130)
    edit()
    frames.run(2, 130)

    expect(applied.at(-1)?.nodes[0]?.name).toBe('Intro')
  })

  /** A game that never aimed the camera must not have a STOP undo an orbit made by hand. */
  it('puts the camera back only when the runtime aimed it', () => {
    const { session, frames, placed } = chained()

    frames.run(130)
    session.stop()

    expect(placed).toHaveLength(0)
  })
})
