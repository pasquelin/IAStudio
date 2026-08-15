import { describe, expect, it } from 'vitest'
import type { AssistantCall } from '@shared/domain/assistant'
import type { AssistantActionRequest } from '@shared/ipc'
import { createRemoteActions } from './asking'

const call: AssistantCall = { action: 'workspace.open', input: { workspace: '3d' } }

/** A window that always takes the request, and hands back what it was asked under. */
function windowThatAnswers() {
  const sent: AssistantActionRequest[] = []
  const actions = createRemoteActions({
    send: request => {
      sent.push(request)
      return true
    },
    newCallId: () => `call_${sent.length + 1}`,
  })

  return { actions, sent }
}

describe('asking the window in front to act', () => {
  it('answers what the window made of it', async () => {
    const { actions } = windowThatAnswers()
    const running = actions.run(call)

    actions.settle({ callId: 'call_1', outcome: { ok: true, data: { opened: true } } })

    await expect(running).resolves.toEqual({ ok: true, data: { opened: true } })
  })

  /**
   * The answer an MCP client gets when the application is minimised with nothing in front.
   * Refused rather than queued: a costly action has nowhere to show its question, and holding
   * it until a window appears would spend on a screen nobody was watching.
   */
  it('refuses outright when there is no window to ask', async () => {
    const actions = createRemoteActions({ send: () => false })

    await expect(actions.run(call)).resolves.toEqual({ ok: false, refusal: 'noWindow' })
  })

  it('gives up after its own wait rather than leaving the caller hanging', async () => {
    const actions = createRemoteActions({ send: () => true, timeoutMs: 1 })

    await expect(actions.run(call)).resolves.toEqual({ ok: false, refusal: 'timedOut' })
  })

  // An answer that arrives after the wait ended, or a window answering twice.
  it('drops an answer nobody is waiting on', () => {
    const { actions } = windowThatAnswers()

    expect(() => actions.settle({ callId: 'call_9', outcome: { ok: true } })).not.toThrow()
  })

  it('keeps two calls apart', async () => {
    const { actions } = windowThatAnswers()
    const first = actions.run(call)
    const second = actions.run(call)

    actions.settle({ callId: 'call_2', outcome: { ok: false, refusal: 'declined' } })
    actions.settle({ callId: 'call_1', outcome: { ok: true } })

    await expect(first).resolves.toEqual({ ok: true })
    await expect(second).resolves.toEqual({ ok: false, refusal: 'declined' })
  })

  it('sends the call as it was given, under an id of its own', () => {
    const { actions, sent } = windowThatAnswers()
    void actions.run(call)

    expect(sent).toEqual([{ callId: 'call_1', call }])
  })
})
