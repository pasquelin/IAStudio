import { describe, expect, it } from 'vitest'
import type { AssistantProgress } from '@shared/domain/assistant'
import type { FrameCoalesce } from '@/engines/core/frameCoalesce'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssistant } from '@/stores/assistant'
import { connectThoughtStream } from './thoughtStream'

/** Every frame painted at once: what this suite is about is the wiring, not the pacing. */
const paintEveryFrame = (): FrameCoalesce => ({
  schedule: (value, apply) => apply(value),
  flush: () => {},
  cancel: () => {},
})

describe('connectThoughtStream', () => {
  /**
   * The wiring and nothing else — but nothing else would catch its absence: a window that never
   * subscribes leaves every gate green and shows a spinner for minutes.
   */
  it('writes what the main process pushes into the thread', () => {
    const pushes: ((progress: AssistantProgress) => void)[] = []
    installFakeBridge({
      assistant: {
        onStream: (callback: (progress: AssistantProgress) => void) => {
          pushes.push(callback)
          return () => {}
        },
      },
    })
    useAssistant.setState({ streamed: '', promptTokens: 0, replyTokens: 0 })

    connectThoughtStream(paintEveryFrame())
    pushes[0]?.({ delta: 'writing', promptTokens: 2366 })

    expect(useAssistant.getState()).toMatchObject({ streamed: 'writing', promptTokens: 2366 })
  })

  /**
   * 🛑 What `schedule` keeps is the LAST value it was given, so the tokens between two painted
   * frames have to be joined before they get there — relayed one by one they were a render each,
   * and kept naively only the last of each frame would reach the thread.
   */
  it('joins the tokens that arrive between two painted frames', () => {
    const painted: (() => void)[] = []
    let push: ((progress: AssistantProgress) => void) | null = null
    installFakeBridge({
      assistant: {
        onStream: (callback: (progress: AssistantProgress) => void) => {
          push = callback
          return () => {}
        },
      },
    })
    useAssistant.setState({ streamed: '', promptTokens: 0, replyTokens: 0 })

    connectThoughtStream({
      schedule: (value, apply) => painted.push(() => apply(value)),
      flush: () => {},
      cancel: () => {},
    })
    const send = push as unknown as (progress: AssistantProgress) => void
    send({ delta: 'one ' })
    send({ delta: 'two ' })
    send({ delta: 'three' })
    painted.at(-1)?.()

    expect(useAssistant.getState().streamed).toBe('one two three')
  })
})
