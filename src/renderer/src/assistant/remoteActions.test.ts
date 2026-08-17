import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionName, ActionOutcome } from '@shared/domain/assistant'
import type { AssistantActionRequest, AssistantActionResult } from '@shared/ipc'
import { installFakeBridge } from '@/services/fakeBridge'
import { connectRemoteActions } from './remoteActions'

/**
 * The executor stands in: what each action does is its own suite's business. What this one is
 * about is that an action asked for from outside meets the SAME gate the modal uses, and that
 * an answer always goes back.
 */
const runConfirmedAction = vi.hoisted(() =>
  vi.fn<(name: ActionName, input: Record<string, unknown>) => Promise<ActionOutcome>>(),
)
vi.mock('./executor', () => ({ runConfirmedAction }))

/** A bridge that hands back the way to push an action, and what the window answered. */
function connected() {
  let push: ((request: AssistantActionRequest) => void) | null = null
  const answers: AssistantActionResult[] = []

  installFakeBridge({
    assistant: {
      onAction: (callback: (request: AssistantActionRequest) => void) => {
        push = callback
        return () => {}
      },
      actionResult: (result: AssistantActionResult) => {
        answers.push(result)
        return Promise.resolve()
      },
    },
  })

  const stop = connectRemoteActions()
  return { push: (request: AssistantActionRequest) => push?.(request), answers, stop }
}

beforeEach(() => {
  runConfirmedAction.mockReset()
  runConfirmedAction.mockResolvedValue({ ok: true })
})

describe('an action asked for from outside the window', () => {
  it('goes through the same gate as one the modal decided on', async () => {
    const { push, answers } = connected()
    push({ callId: 'call_1', call: { action: 'workspace.open', input: { workspace: '3d' } } })
    await vi.waitFor(() => expect(answers).toHaveLength(1))

    expect(runConfirmedAction).toHaveBeenCalledWith('workspace.open', { workspace: '3d' })
    expect(answers[0]).toEqual({ callId: 'call_1', outcome: { ok: true } })
  })

  it('answers under the id it was asked, refusal and all', async () => {
    runConfirmedAction.mockResolvedValue({ ok: false, refusal: 'declined' })
    const { push, answers } = connected()
    push({ callId: 'call_7', call: { action: 'generator.submit', input: {} } })
    await vi.waitFor(() => expect(answers).toHaveLength(1))

    expect(answers[0]).toEqual({ callId: 'call_7', outcome: { ok: false, refusal: 'declined' } })
  })

  /**
   * The name crossed a boundary, so the compiler cannot vouch for it here — and on the other
   * end somebody waits two minutes for an answer that would otherwise never come.
   */
  it('answers rather than acting when the name is not one the registry declares', async () => {
    const { push, answers } = connected()
    // Cast because the boundary type says `ActionName` and this test is about what happens when
    // the runtime value is not one — which is exactly what the compiler cannot express here.
    push({ callId: 'call_2', call: { action: 'command.fly' as ActionName, input: {} } })
    await vi.waitFor(() => expect(answers).toHaveLength(1))

    expect(runConfirmedAction).not.toHaveBeenCalled()
    expect(answers[0]?.outcome).toEqual({ ok: false, refusal: 'badInput' })
  })

  it('answers rather than going quiet when the action itself threw', async () => {
    runConfirmedAction.mockRejectedValue(new Error('the panel is gone'))
    const { push, answers } = connected()
    push({ callId: 'call_3', call: { action: 'jobs.list', input: {} } })
    await vi.waitFor(() => expect(answers).toHaveLength(1))

    expect(answers[0]?.outcome).toEqual({ ok: false, refusal: 'failed' })
  })
})
