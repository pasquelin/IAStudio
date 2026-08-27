import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drawing } from '@/game/game-fixtures'
import { installScene } from '@/stores/scene-fixtures'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { usePlay } from '@/stores/play'
import { runAction } from './executor'

const DOCUMENT = 'doc-1'

/** The loop the lot exists for, read through the same door an MCP client comes in by. */
describe('a game driven from outside the window', () => {
  beforeEach(() => {
    installScene(DOCUMENT)
    registerSceneEngine(DOCUMENT, drawing())
    usePlay.setState({ reports: {} })
    return () => forgetSceneEngine(DOCUMENT)
  })

  /** 🛑 At once: a start that waited for the WebAssembly would hold an MCP client for a second. */
  it('starts a game and answers without waiting for a frame', async () => {
    const outcome = await runAction('play.start', {})

    expect(outcome.ok).toBe(true)
  })

  it('refuses to play a scene no viewport draws', async () => {
    forgetSceneEngine(DOCUMENT)

    const outcome = await runAction('play.start', {})

    expect(outcome).toMatchObject({ ok: false, refusal: 'wrongSurface' })
  })

  /** 🛑 A reading taken while sixty frames a second run is a reading of a different world. */
  it('refuses to step a game that is not paused', async () => {
    const outcome = await runAction('play.step', { steps: 3 })

    expect(outcome).toMatchObject({ ok: false, refusal: 'badInput' })
  })

  it('answers what the game says about itself', async () => {
    const outcome = await runAction('runtime.report', {})

    expect(outcome.ok && outcome.data).toMatchObject({ state: 'edit', tick: 0 })
  })

  /** ADDRESSABLE, which is what closes the loop: a message alone repairs nothing. */
  it('answers the faults with the script and the line an editor opens', async () => {
    usePlay.setState({
      reports: {
        [DOCUMENT]: {
          state: 'playing',
          tick: 4,
          fps: 60,
          frameMs: 16,
          entities: 1,
          logs: [],
          errors: [
            { script: 'script:Walk.ts', entity: null, message: 'no', line: 7, column: 3, at: 1 },
          ],
        },
      },
    })

    const outcome = await runAction('runtime.errors', {})

    expect(outcome.ok && outcome.data).toMatchObject({
      errors: [{ script: 'script:Walk.ts', line: 7, column: 3 }],
    })
  })
})

// The scene in front is what a dock announces, and nothing announces one headless.
vi.mock('@/stores/documents', async importActual => {
  const held = await importActual<Record<string, unknown>>()
  return { ...held, activeSceneId: () => DOCUMENT }
})
