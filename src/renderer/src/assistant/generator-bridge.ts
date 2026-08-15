import type { Job } from '@shared/domain/job'
import { createMountedHost } from '@/helpers/host-registry'

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

const host = createMountedHost<GeneratorBridge>()

/** Declares the generator while it is on screen. Returns the way to take it back down. */
export const registerGenerator = host.hold

/** The generator, if one is mounted. `null` is an answer, not a failure: the panel may be closed. */
export const mountedGenerator = host.get
