import { createMountedHost } from '@/helpers/hostRegistry'

/** What the model asked the person, and what it offered them to press. */
export type ChoiceRequest = { question: string; choices: readonly string[] }

/** Answers what was pressed, or `null` where the question was dismissed. */
export type Chooser = (request: ChoiceRequest) => Promise<string | null>

const host = createMountedHost<Chooser>()

/** Declares where questions with choices are asked. Returns the way to take it back down. */
export const registerChooser = host.hold

/**
 * Whoever is able to ask, or `null` where nobody is — a window with no shell, and a headless run.
 * The action refuses rather than waiting: a question nobody can see is never answered.
 */
export const mountedChooser = host.get
