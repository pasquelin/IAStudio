import type { ActionName } from '@shared/domain/assistant'
import type { FakeStudio } from './fakeStudio'

/** What a run of one scenario produced, as an oracle reads it. */
export type Run = {
  studio: FakeStudio
  called: readonly { action: ActionName; input: Record<string, unknown> }[]
  /** What the studio answered each of those, in the same order — a refusal, or what came back. */
  answers: readonly string[]
  refused: number
  /** Everything the model said to the person, every turn joined. */
  said: string
}

export type Scenario = {
  name: string
  /**
   * What the person types, one sentence per turn. The studio and the history CARRY between them:
   * "add a cube" then "rename it" is one conversation, and a bench that reset in between would
   * be measuring a studio nobody was looking at.
   */
  said: readonly string[]
  /**
   * What the studio holds before the person speaks, laid out by the BENCH rather than by the
   * model — « dans la scène Test MCP » is a decor, not a thing to be scored a second time.
   * A function and not a list of calls: the ids only come back from running them.
   */
  setup?: (studio: FakeStudio) => void
  /**
   * Whether the request was carried out — read off what the studio HOLDS, never off the words
   * the model wrote. Every failure this bench exists for was announced as a success.
   */
  passed: (run: Run) => boolean
}
