import { beforeEach, describe, expect, it, vi } from 'vitest'
import { newComponent } from '@shared/domain/componentRegistry'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { installScene } from '@/stores/scene-fixtures'
import { runAction } from './executor'

const DOCUMENT = 'doc-1'

describe('what keeps a model from guessing', () => {
  beforeEach(() => {
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [{ ...meshNode('n1'), name: 'Hero', components: [newComponent('Health')] }],
    })
  })

  /** 🛑 The schema comes WITH the component: a second call to learn what may be written is one
   * a model would have to guess it needed. */
  it('describes an object with its components and their schema', async () => {
    const outcome = await runAction('studio.describe', { ref: 'Hero' })

    expect(outcome.ok && outcome.data).toMatchObject({ name: 'Hero' })
    const data = outcome.ok
      ? (outcome.data as { components: { type: string; schema: unknown[] }[] })
      : null
    expect(data?.components[0]?.type).toBe('Health')
    expect(data?.components[0]?.schema.length).toBeGreaterThan(0)
  })

  it('says what may still be added, which is what a repair reads', async () => {
    const outcome = await runAction('studio.describe', { ref: 'Hero' })

    const data = outcome.ok ? (outcome.data as { available: { components: string[] } }) : null
    expect(data?.available.components).toContain('Movement')
    expect(data?.available.components).not.toContain('Health')
  })

  it('answers the whole scene when nothing is named', async () => {
    const outcome = await runAction('studio.describe', {})

    expect(outcome.ok && outcome.data).toMatchObject({ scene: DOCUMENT })
  })

  it('names the topics it can document, then documents one', async () => {
    const listed = await runAction('studio.docs', {})
    const held = await runAction('studio.docs', { topic: 'Health' })

    expect(listed.ok && (listed.data as { topics: string[] }).topics).toContain('Health')
    expect(held.ok && held.data).toMatchObject({ topic: 'Health' })
  })

  /** The SAME text the editor types against — a second telling is the one that would drift. */
  it('serves the sandbox surface a script sees', async () => {
    const outcome = await runAction('studio.docs', { topic: 'script' })

    expect(outcome.ok && String((outcome.data as { docs: string }).docs)).toContain('defineScript')
  })

  it('refuses a topic nothing documents, and says how to find the list', async () => {
    const outcome = await runAction('studio.docs', { topic: 'Whatever' })

    expect(outcome).toMatchObject({ ok: false, refusal: 'notFound' })
  })

  describe('a lot of calls run as one', () => {
    it('runs them in order and answers how many ran', async () => {
      const outcome = await runAction('studio.batch', {
        calls: JSON.stringify([
          { action: 'component.attach', input: { nodeId: 'Hero', type: 'Movement' } },
          {
            action: 'component.set',
            input: { nodeId: 'Hero', type: 'Movement', field: 'speed', value: '9' },
          },
        ]),
      })

      expect(outcome.ok && outcome.data).toMatchObject({ ran: 2 })
    })

    /** 🛑 Which call failed, by rank: a bare refusal has a client re-sending the whole lot. */
    it('stops at the first refusal and says which call it was', async () => {
      const outcome = await runAction('studio.batch', {
        calls: JSON.stringify([
          { action: 'component.attach', input: { nodeId: 'Hero', type: 'Movement' } },
          { action: 'component.attach', input: { nodeId: 'Nobody', type: 'Health' } },
        ]),
      })

      expect(outcome.ok).toBe(false)
      expect(!outcome.ok && outcome.detail).toContain('call 1')
    })

    it('refuses a batch holding a batch, and one naming an action nothing publishes', async () => {
      const nested = await runAction('studio.batch', {
        calls: JSON.stringify([{ action: 'studio.batch', input: {} }]),
      })
      const unknown = await runAction('studio.batch', {
        calls: JSON.stringify([{ action: 'nothing.here', input: {} }]),
      })

      expect(nested).toMatchObject({ ok: false, refusal: 'badInput' })
      expect(unknown).toMatchObject({ ok: false, refusal: 'badInput' })
    })

    it('refuses calls that are not a JSON array of calls', async () => {
      expect(await runAction('studio.batch', { calls: 'not json' })).toMatchObject({ ok: false })
    })
  })
})

// The scene in front is what a dock announces, and nothing announces one headless.
vi.mock('@/stores/documents', async importActual => {
  const held = await importActual<Record<string, unknown>>()
  return { ...held, activeSceneId: () => DOCUMENT }
})
