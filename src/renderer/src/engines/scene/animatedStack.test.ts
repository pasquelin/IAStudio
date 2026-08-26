import { describe, expect, it, vi } from 'vitest'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import { EMPTY_STACK, type PostStack } from '@shared/domain/postProcessing'
import { SECOND } from '@shared/domain/time'
import { createAnimatedStacks } from './animatedStack'

const stack = (): PostStack => ({ ...EMPTY_STACK, effects: [] })
const band = (): AnimationTimeline => ({ ...EMPTY_TIMELINE })

/** Answers a fresh object every call, exactly as `postAt` does once a channel drives the stack. */
const resolver = () => vi.fn((rest: PostStack): PostStack => ({ ...rest }))

describe('the stack a surface films through', () => {
  it('resolves once however many surfaces ask for it', () => {
    const resolve = resolver()
    const stacks = createAnimatedStacks(resolve)
    const rest = stack()
    const timeline = band()

    // A quad with a preview open: five surfaces, one image, one composition.
    const answers = [0, 0, 0, 0, 0].map(() => stacks.of(rest, timeline, '@scene', SECOND))

    expect(resolve).toHaveBeenCalledTimes(1)
    // The SAME object, which is what the plan cache keys on — a fresh one re-plans the chain.
    expect(new Set(answers).size).toBe(1)
  })

  it('keeps each subject apart', () => {
    const resolve = resolver()
    const stacks = createAnimatedStacks(resolve)
    const rest = stack()
    const timeline = band()

    stacks.of(rest, timeline, '@scene', 0)
    stacks.of(rest, timeline, 'camera-1', 0)

    expect(resolve).toHaveBeenCalledTimes(2)
  })

  /**
   * Three things move independently, and a guard blind to any one of them draws yesterday's look
   * with every gate green: scrubbing moves the head alone, a slider moves the rest stack alone,
   * and dragging a keyframe moves the BAND while leaving both the others untouched.
   */
  it.each([
    ['the head moves', (held: Parameters<typeof next>[0]) => next({ ...held, at: 2 * SECOND })],
    [
      'a slider moves the rest stack',
      (held: Parameters<typeof next>[0]) => next({ ...held, rest: stack() }),
    ],
    [
      'a keyframe moves the band',
      (held: Parameters<typeof next>[0]) => next({ ...held, timeline: band() }),
    ],
  ])('resolves again when %s', (_what, ask) => {
    const resolve = resolver()
    const stacks = createAnimatedStacks(resolve)
    const held = { stacks, rest: stack(), timeline: band(), at: SECOND }

    stacks.of(held.rest, held.timeline, '@scene', held.at)
    ask(held)

    expect(resolve).toHaveBeenCalledTimes(2)
  })
})

/** Asks again with whatever the case changed, on the same subject. */
function next(held: {
  stacks: ReturnType<typeof createAnimatedStacks>
  rest: PostStack
  timeline: AnimationTimeline
  at: number
}): PostStack {
  return held.stacks.of(held.rest, held.timeline, '@scene', held.at)
}
