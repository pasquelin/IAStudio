import { afterEach, describe, expect, it, vi } from 'vitest'
import { NOT_PLAYING } from '@shared/domain/gameRuntime'
import { createInertPhysics } from '@game/host/inertPhysics'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { drawing } from '@/game/game-fixtures'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { installScene } from './scene-fixtures'
import { playReportOf, usePlay } from './play'
import { forgetSceneEngine, registerSceneEngine } from './sceneEngines'

/**
 * The engine is 2,7 Mo of WebAssembly and this suite measures the STORE — which game exists, and
 * when it is forgotten. What it does need from the real thing is the wait: `start` now answers
 * before the world exists, and that is what `waitFor` is here for.
 */
vi.mock('@game/host/rapierPhysics', () => ({
  loadRapierPhysics: () => Promise.resolve(createInertPhysics()),
}))

const DOCUMENT = 'doc-scene'

const opened = (): void => {
  installScene(DOCUMENT, { ...createDefaultScene(), nodes: [meshNode('a')], selectedIds: [] })
}

const report = () => playReportOf(usePlay.getState(), DOCUMENT)

afterEach(() => {
  usePlay.getState().stop(DOCUMENT)
  forgetSceneEngine(DOCUMENT)
})

describe('a game running per document', () => {
  /** The runtime draws through the engine the viewport owns: without one there is nothing to run. */
  it('starts nothing for a document whose viewport is not mounted', () => {
    opened()

    usePlay.getState().start(DOCUMENT, new EventTarget())

    expect(report()).toBe(NOT_PLAYING)
  })

  it('says what it holds once started, and forgets it when stopped', async () => {
    opened()
    registerSceneEngine(DOCUMENT, drawing())

    usePlay.getState().start(DOCUMENT, new EventTarget())
    await vi.waitFor(() => expect(report()).toMatchObject({ state: 'playing', entities: 1 }))

    usePlay.getState().stop(DOCUMENT)
    expect(report()).toBe(NOT_PLAYING)
  })

  /** A second Play on a document already playing must not leave two loops driving one viewport. */
  it('keeps one game per document, however many times Play is pressed', async () => {
    opened()
    registerSceneEngine(DOCUMENT, drawing())

    usePlay.getState().start(DOCUMENT, new EventTarget())
    usePlay.getState().start(DOCUMENT, new EventTarget())
    await vi.waitFor(() => expect(report().state).toBe('playing'))

    const first = report()
    usePlay.getState().start(DOCUMENT, new EventTarget())

    expect(report()).toBe(first)
  })

  /**
   * A stop while the engine is still loading. Without the waiting list, the session the click
   * cancelled would be created a moment later and left running with nothing to stop it.
   */
  it('starts nothing when the game is stopped while its engine loads', async () => {
    opened()
    registerSceneEngine(DOCUMENT, drawing())

    usePlay.getState().start(DOCUMENT, new EventTarget())
    usePlay.getState().stop(DOCUMENT)
    await vi.waitFor(() => expect(report()).toBe(NOT_PLAYING))

    expect(report()).toBe(NOT_PLAYING)
  })

  it('says nothing, and throws nothing, when a document nobody played is stopped', () => {
    expect(() => usePlay.getState().stop('never-played')).not.toThrow()
  })
})
