import { beforeEach, describe, expect, it } from 'vitest'
import i18next from 'i18next'
import type { MemoryDraft, MemoryScope } from '@shared/domain/assistantMemory'
import { installFakeBridge } from '@/services/fakeBridge'
import { rememberOutcome } from './rememberOutcome'

const written: { scope: MemoryScope; draft: MemoryDraft }[] = []

beforeEach(async () => {
  written.length = 0
  await i18next.init({
    lng: 'fr',
    resources: {
      fr: {
        translation: {
          memoryWorth: { scriptWrite: 'Le script {{path}} a été écrit par l’assistant' },
        },
      },
    },
  })
  installFakeBridge({
    memory: {
      remember: async (scope: MemoryScope, draft: MemoryDraft) => {
        written.push({ scope, draft })
        return null
      },
    },
  })
})

describe('what an action leaves behind', () => {
  /**
   * 🛑 Interpolation UNESCAPED, and the harness leaves escaping on to prove it: a summary goes
   * into a file a project carries, and escaping turned a path into one nothing would match.
   */
  it('writes the memory its rule drew, in the person’s language', async () => {
    await rememberOutcome('script.write', { path: 'Scripts/Cam.ts' }, { ok: true })

    expect(written).toEqual([
      {
        scope: 'project',
        draft: {
          type: 'script',
          summary: 'Le script Scripts/Cam.ts a été écrit par l’assistant',
          importance: 4,
          source: { kind: 'action', ref: 'script.write' },
          refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }],
        },
      },
    ])
  })

  /** A refused action changed nothing, so there is nothing it taught. */
  it('writes nothing for an action that was refused', async () => {
    await rememberOutcome(
      'script.write',
      { path: 'Scripts/Cam.ts' },
      {
        ok: false,
        refusal: 'notFound',
      },
    )

    expect(written).toEqual([])
  })

  it('writes nothing for the actions the table answers null for', async () => {
    await rememberOutcome('node.transform', { node: 'n_1' }, { ok: true })

    expect(written).toEqual([])
  })

  /**
   * 🛑 An action is done when the studio changed. A memory that would not persist must not turn
   * a successful call into a failure the model then tries to repair.
   */
  it('answers false rather than throwing when the memory refuses', async () => {
    installFakeBridge({
      memory: { remember: () => Promise.reject(new Error('no project open')) },
    })

    await expect(
      rememberOutcome('script.write', { path: 'Scripts/Cam.ts' }, { ok: true }),
    ).resolves.toBe(false)
  })
})
