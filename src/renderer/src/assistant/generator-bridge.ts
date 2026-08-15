import type { Job } from '@shared/domain/job'

/**
 * The generator's form, reachable from outside it.
 *
 * The form has no external state on purpose: `DynamicForm` holds its values in react-hook-form
 * and the only way in is the `preset` it resets on. That is fine for filling it — `prepare`
 * writes the preset and the form rebuilds — and useless for reading it back, which is exactly
 * what the assistant needs before it may quote a cost or send anything.
 *
 * So the generator declares itself while it is mounted, the way the command bus lets the menu
 * reach the tab in front. Two functions rather than one: the assistant has to see the body
 * BEFORE it submits it, because a figure is quoted first and a yes is asked for after.
 *
 * `submit` is the panel's own submit, not a reimplementation of it — the claim that routes the
 * result to the space that asked for it is part of what the button does, and a second path that
 * skipped it would land generations nowhere.
 */
export type GeneratorBridge = {
  /** What would be sent, as the form stands. `null` when nothing is armed. */
  body: () => { modelId: string; values: Record<string, unknown> } | null
  submit: () => Promise<Job | null>
  /**
   * The reference pictures sitting on the form, as asset ids.
   *
   * Read from here rather than named by whoever asks: which fields hold a picture is a fact of
   * the model's schema, and only the panel has it. Asking a language model to name them would
   * have it invent ids.
   */
  references: () => string[]
}

let mounted: GeneratorBridge | null = null

/** Declares the generator while it is on screen. Returns the way to take it back down. */
export function registerGenerator(bridge: GeneratorBridge): () => void {
  mounted = bridge
  return () => {
    // Only if it is still ours: two generators never coexist, but a panel torn down after its
    // replacement mounted would otherwise unregister the live one.
    if (mounted === bridge) mounted = null
  }
}

/** The generator, if one is mounted. `null` is an answer, not a failure: the panel may be closed. */
export function mountedGenerator(): GeneratorBridge | null {
  return mounted
}
