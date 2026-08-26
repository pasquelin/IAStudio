/**
 * One subject's composition at the head, held for the IMAGE.
 *
 * `compose` runs once per SURFACE — five times in a quad with a preview open — and `postAt`
 * builds a fresh object whenever a channel drives the stack. A fresh object misses the plan cache
 * `planStack` keys on identity, so one composition that had not moved was re-planned five times
 * an image: filter, spread, sort, `Set`, `map`, `join`, and five throwaway entries.
 *
 * Its own module, and not a `Map` inside `SceneRenderer`, because what is subtle here has nothing
 * to do with the GPU: the guard must compare EVERYTHING the answer was derived from, and a guard
 * missing one of the three draws yesterday's look with every gate green.
 */
import type { AnimationTimeline } from '@shared/domain/animation'
import type { PostStack } from '@shared/domain/postProcessing'
import type { Us } from '@shared/domain/time'

/** What an answer was derived from. All three move independently — see `AnimatedStacks`. */
type Held = {
  /** The stack as the document holds it. A slider moves this and leaves the head still. */
  rest: PostStack
  /** The band. Dragging a keyframe moves this and leaves both the head and the rest alone. */
  timeline: AnimationTimeline
  at: Us
  made: PostStack
}

export type AnimatedStacks = {
  /** The stack for that subject, resolved once per image however many surfaces ask. */
  of: (rest: PostStack, timeline: AnimationTimeline, subject: string, at: Us) => PostStack
}

export type StackResolver = (
  rest: PostStack,
  timeline: AnimationTimeline,
  subject: string,
  at: Us,
) => PostStack

export function createAnimatedStacks(resolve: StackResolver): AnimatedStacks {
  const held = new Map<string, Held>()

  return {
    of: (rest, timeline, subject, at) => {
      const found = held.get(subject)
      if (found && found.rest === rest && found.timeline === timeline && found.at === at) {
        return found.made
      }

      const made = resolve(rest, timeline, subject, at)
      held.set(subject, { rest, timeline, at, made })
      return made
    },
  }
}
