/**
 * The ceiling on a chain: how many times one sentence may send the model back to work.
 *
 * Its own module rather than a constant in `settings.ts`, which `shellActions.ts` reads and the
 * registry reads back — `import-cycles.test.ts` holds that count at zero.
 */
export const ASSISTANT_STEPS_DEFAULT = 12

/**
 * TWO, not one: a chain ends cleanly only when the model answers with NO calls, which costs a
 * round of its own. At one, every turn that ran a single action fell out at the ceiling and was
 * reported — to the person and to the model — as cut short when it had in fact finished.
 */
export const ASSISTANT_STEPS_MIN = 2
export const ASSISTANT_STEPS_MAX = 40

export const assistantStepsWithin = (steps: number): number =>
  Math.min(ASSISTANT_STEPS_MAX, Math.max(ASSISTANT_STEPS_MIN, Math.trunc(steps)))
