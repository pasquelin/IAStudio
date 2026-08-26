import { afterEach, describe, expect, it } from 'vitest'
import { NOT_PLAYING } from '@shared/domain/gameRuntime'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { installScene } from './scene-fixtures'
import { playReportOf, usePlay } from './play'
import { forgetSceneEngine, registerSceneEngine } from './sceneEngines'

const DOCUMENT = 'doc-scene'

const drawing = (): SceneRenderer => {
  const engine = { apply: () => {} }
  // The registry holds a whole `SceneRenderer`, and a running game asks it for one method — see
  // `SceneDraw`. Standing in for the rest would mean a WebGL context this suite has not got.
  return engine as unknown as SceneRenderer
}

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

  it('says what it holds once started, and forgets it when stopped', () => {
    opened()
    registerSceneEngine(DOCUMENT, drawing())

    usePlay.getState().start(DOCUMENT, new EventTarget())
    expect(report()).toMatchObject({ state: 'playing', entities: 1 })

    usePlay.getState().stop(DOCUMENT)
    expect(report()).toBe(NOT_PLAYING)
  })

  /** A second Play on a document already playing must not leave two loops driving one viewport. */
  it('keeps one game per document, however many times Play is pressed', () => {
    opened()
    registerSceneEngine(DOCUMENT, drawing())

    usePlay.getState().start(DOCUMENT, new EventTarget())
    const first = report()
    usePlay.getState().start(DOCUMENT, new EventTarget())

    expect(report()).toBe(first)
  })

  it('says nothing, and throws nothing, when a document nobody played is stopped', () => {
    expect(() => usePlay.getState().stop('never-played')).not.toThrow()
  })
})
