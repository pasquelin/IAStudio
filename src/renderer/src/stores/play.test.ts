import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NOT_PLAYING } from '@shared/domain/gameRuntime'
import { createInertPhysics } from '@game/host/inertPhysics'
import { createInertScripts } from '@game/host/inertScripts'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { drawing } from '@/game/game-fixtures'
import { createGameStage, type GameStage } from '@/game/gameStage'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { installScene } from './scene-fixtures'
import { playReportOf, usePlay } from './play'
import { forgetSceneEngine, registerSceneEngine } from './sceneEngines'

/**
 * The engine is 2,7 Mo of WebAssembly and this suite measures the STUDIO half — which game the
 * window was told to play, what comes back, and when it is forgotten.
 */
vi.mock('@game/host/rapierPhysics', () => ({
  loadRapierPhysics: () => Promise.resolve(createInertPhysics()),
}))

/** And the sandbox with it: a suite that measures a transport must not wait on a JIT. */
vi.mock('@game/host/quickjsScripts', () => ({
  loadQuickjsScripts: () => Promise.resolve(createInertScripts()),
}))

const DOCUMENT = 'doc-scene'
const OTHER = 'doc-other-scene'

const opened = (): void => {
  installScene(DOCUMENT, { ...createDefaultScene(), nodes: [meshNode('a')], selectedIds: [] })
}

const report = () => playReportOf(usePlay.getState(), DOCUMENT)

/**
 * 🛑 The very stage the game window mounts, on the same channel: no window opens in a suite, and
 * standing in for one with a hand-written double is how eleven `fake*` modules came to lie.
 */
let stage: GameStage | null = null

/**
 * Every `onClosed` the store ever registered. A list rather than the last one: the channel and its
 * subscription are opened ONCE for the module, so a per-test variable would hold the callback of
 * whichever test happened to play first.
 */
const windowClosers: (() => void)[] = []

beforeEach(() => {
  installFakeBridge({
    gameWindow: {
      open: () => Promise.resolve(),
      close: () => Promise.resolve(),
      onClosed: callback => {
        windowClosers.push(callback)
        return () => {}
      },
    },
  })
  stage = createGameStage({ renderer: drawing(), input: new EventTarget() })
})

afterEach(() => {
  usePlay.getState().stop(DOCUMENT)
  stage?.close()
  stage = null
  forgetSceneEngine(DOCUMENT)
})

describe('a game played in a window of its own', () => {
  /** The studio only publishes a scene it is SHOWING: with no viewport there is nothing to play. */
  it('starts nothing for a document whose viewport is not mounted', async () => {
    opened()

    usePlay.getState().start(DOCUMENT)
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(report()).toBe(NOT_PLAYING)
  })

  it('says what the game window holds once started, and forgets it when stopped', async () => {
    opened()
    registerSceneEngine(DOCUMENT, drawing())

    usePlay.getState().start(DOCUMENT)
    await vi.waitFor(() => expect(report()).toMatchObject({ state: 'playing', entities: 1 }))

    usePlay.getState().stop(DOCUMENT)
    expect(report()).toBe(NOT_PLAYING)
  })

  /** A second Play on a document already playing must not leave two loops running one game. */
  it('keeps one game per document, however many times Play is pressed', async () => {
    opened()
    registerSceneEngine(DOCUMENT, drawing())

    usePlay.getState().start(DOCUMENT)
    usePlay.getState().start(DOCUMENT)
    await vi.waitFor(() => expect(report().state).toBe('playing'))

    const first = report()
    usePlay.getState().start(DOCUMENT)

    expect(report()).toBe(first)
  })

  /**
   * 🛑 The whole reason `pause` crossed a window and came back: a caller told « paused » that was
   * not is one that steps a world still running under it.
   */
  it('answers pause and step from the game window, never from a guess made here', async () => {
    opened()
    registerSceneEngine(DOCUMENT, drawing())

    expect(await usePlay.getState().pause(DOCUMENT)).toBe(false)

    usePlay.getState().start(DOCUMENT)
    await vi.waitFor(() => expect(report().state).toBe('playing'))

    expect(await usePlay.getState().pause(DOCUMENT)).toBe(true)
    await vi.waitFor(() => expect(report().state).toBe('paused'))
    expect(await usePlay.getState().step(DOCUMENT, 10)).toBe(10)

    expect(await usePlay.getState().resume(DOCUMENT)).toBe(true)
    await vi.waitFor(() => expect(report().state).toBe('playing'))
  })

  /**
   * A stop while the scripts are still compiling. Without the guard, the game the click cancelled
   * would be published a moment later and left running with nothing to stop it.
   */
  it('publishes nothing when the game is stopped while its scripts compile', async () => {
    opened()
    registerSceneEngine(DOCUMENT, drawing())

    usePlay.getState().start(DOCUMENT)
    usePlay.getState().stop(DOCUMENT)
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(report()).toBe(NOT_PLAYING)
  })

  /**
   * 🛑 Point of the whole window: closing it with the traffic lights ENDS the game. The studio
   * hears it from the main process, because a renderer being torn down has no turn left to speak.
   */
  it('takes the transport back to edit when the window is closed from the outside', async () => {
    opened()
    registerSceneEngine(DOCUMENT, drawing())

    usePlay.getState().start(DOCUMENT)
    await vi.waitFor(() => expect(report().state).toBe('playing'))

    for (const closed of windowClosers) closed()

    expect(report()).toBe(NOT_PLAYING)
  })

  /** One window holds one game: the scene it was turned away from must stop saying it plays. */
  it('forgets the game it replaces when Play lands on another scene', async () => {
    opened()
    installScene(OTHER, { ...createDefaultScene(), nodes: [meshNode('b')], selectedIds: [] })
    registerSceneEngine(DOCUMENT, drawing())
    registerSceneEngine(OTHER, drawing())

    usePlay.getState().start(DOCUMENT)
    await vi.waitFor(() => expect(report().state).toBe('playing'))

    usePlay.getState().start(OTHER)
    await vi.waitFor(() => expect(playReportOf(usePlay.getState(), OTHER).state).toBe('playing'))

    expect(report()).toBe(NOT_PLAYING)
    usePlay.getState().stop(OTHER)
    forgetSceneEngine(OTHER)
  })

  it('says nothing, and throws nothing, when a document nobody played is stopped', () => {
    expect(() => usePlay.getState().stop('never-played')).not.toThrow()
  })
})
