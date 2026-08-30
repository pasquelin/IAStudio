import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { runAction } from './executor'

const DOCUMENT = 'doc-1'
const timeline = () => sceneOf(useScenes.getState(), DOCUMENT).animation

describe('what a timeline is told to cue', () => {
  beforeEach(() => {
    installScene(DOCUMENT)
  })

  it('cues an event, and answers the id it gave it', async () => {
    const outcome = await runAction('timeline.addSceneCue', {
      list: 'events',
      at: 2_000_000,
      what: 'DoorOpened',
    })

    expect(outcome.ok).toBe(true)
    expect(timeline().events).toMatchObject([{ at: 2_000_000, name: 'DoorOpened' }])
  })

  it('cues a transition of a kind the engine knows', async () => {
    await runAction('timeline.addSceneCue', {
      list: 'transitions',
      at: 3_000_000,
      what: 'fade',
      duration: 1_000_000,
    })

    expect(timeline().transitions).toMatchObject([{ kind: 'fade', duration: 1_000_000 }])
  })

  /** Told apart rather than lumped: a model repairs a wrong list and a wrong kind differently. */
  it('refuses a list nothing holds, and a transition of no known kind', async () => {
    expect(
      await runAction('timeline.addSceneCue', { list: 'markers', at: 0, what: 'x' }),
    ).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(
      await runAction('timeline.addSceneCue', {
        list: 'transitions',
        at: 0,
        what: 'iris',
        duration: 1,
      }),
    ).toMatchObject({ ok: false, refusal: 'badInput' })
  })

  /** A sound with no length plays nothing at all, which is not what the caller asked for. */
  it('refuses a sound with no asset and one with no length', async () => {
    expect(
      await runAction('timeline.addSceneCue', { list: 'audio', at: 0, what: '', duration: 5 }),
    ).toMatchObject({ ok: false })
    expect(
      await runAction('timeline.addSceneCue', { list: 'audio', at: 0, what: 'music', duration: 0 }),
    ).toMatchObject({ ok: false })
  })

  it('takes a row back off, and refuses one that is not there', async () => {
    const held = await runAction('timeline.addSceneCue', { list: 'events', at: 0, what: 'Opened' })
    const id = held.ok ? (held.data as { id: string }).id : ''

    expect(await runAction('timeline.removeSceneCue', { list: 'events', id })).toMatchObject({
      ok: true,
    })
    expect(timeline().events).toEqual([])
    expect(await runAction('timeline.removeSceneCue', { list: 'events', id })).toMatchObject({
      ok: false,
    })
  })

  it('sets what the panel offers, and refuses setting it to what it already is', async () => {
    expect(await runAction('timeline.setPanelRows', { template: 'intro' })).toMatchObject({
      ok: true,
    })
    expect(timeline().template).toBe('intro')
    expect(await runAction('timeline.setPanelRows', { template: 'intro' })).toMatchObject({
      ok: false,
    })
  })
})

// The scene in front is what a dock announces, and nothing announces one headless.
vi.mock('@/stores/documents', async importActual => {
  const held = await importActual<Record<string, unknown>>()
  return { ...held, activeSceneId: () => DOCUMENT }
})
