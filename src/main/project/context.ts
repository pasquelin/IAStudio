import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isRecord } from '@shared/guards'
import {
  CONTEXT_VERSION,
  noContext,
  type ContextCard,
  type ContextState,
  type ContextTrouble,
} from '@shared/domain/projectContext'
import { isMissing, writeAtomic, writeQueue } from '@main/persistence'
import { hideFromExplorer } from './hideFromExplorer'
import { parseProjectContext } from './validation'

/**
 * Under a dot for a reason that is not cosmetic: the reconciling pass excludes everything under
 * one (`projectDisk.ts`), so a visible file here would be walked on every open.
 */
export const PROJECT_CONTEXT_FILE = '.project-context.json'

/** Thrown rather than swallowed: what this refuses to overwrite is an hour of someone's writing. */
export class ContextLockedError extends Error {
  constructor(readonly trouble: ContextTrouble) {
    super(`project context is ${trouble}`)
  }
}

export type ProjectContextStore = {
  read: () => Promise<ContextState>
  /** The whole list in, the whole truth back — as the styles and the favourites do. */
  write: (cards: readonly ContextCard[]) => Promise<ContextState>
}

export type ProjectContextDeps = {
  rootOf: () => string | null
}

/**
 * 🛑 Two windows on one project both write the WHOLE list and the last one wins: a card added in
 * the other between this one's read and its write is gone without a word — as the styles are.
 */
export function createProjectContext(deps: ProjectContextDeps): ProjectContextStore {
  const writes = writeQueue()

  const fileOf = (): string | null => {
    const root = deps.rootOf()
    return root === null ? null : join(root, PROJECT_CONTEXT_FILE)
  }

  // Takes the file rather than asking for it: `write` resolves it once and checks THAT one, where
  // a second `rootOf()` would read the project opened in between and refuse — or allow — on it.
  const readFrom = async (file: string): Promise<ContextState> => {
    let body: string
    try {
      body = await readFile(file, 'utf8')
    } catch (error) {
      // A project that never wrote one is the ordinary case, and it has no context — not a fault.
      if (isMissing(error)) return noContext()
      return { cards: [], trouble: 'unreadable' }
    }

    return stateOf(body)
  }

  const read = async (): Promise<ContextState> => {
    const file = fileOf()
    return file === null ? noContext() : await readFrom(file)
  }

  const write = async (cards: readonly ContextCard[]): Promise<ContextState> => {
    const file = fileOf()
    if (file === null) throw new Error('no project is open')

    // Read before write, and the refusal is the point — see `ContextLockedError`.
    const trouble = (await readFrom(file)).trouble
    if (trouble !== null) throw new ContextLockedError(trouble)

    const stored = { version: CONTEXT_VERSION, cards: [...cards] }
    // Indented, because a file meant to be read and versioned by hand is not minified — and
    // atomic through a queue, because two windows saving at once must not tear it in half.
    await writes.next(() => writeAtomic(file, JSON.stringify(stored, null, 2)))
    await hideFromExplorer(file)

    return { cards: stored.cards, trouble: null }
  }

  return { read, write }
}

/** The version is read before the schema, so « update the studio » and « repair it » stay apart. */
function stateOf(body: string): ContextState {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { cards: [], trouble: 'unreadable' }
  }

  if (isRecord(parsed) && typeof parsed.version === 'number' && parsed.version > CONTEXT_VERSION) {
    return { cards: [], trouble: 'too-new' }
  }

  try {
    return { cards: parseProjectContext(parsed).cards, trouble: null }
  } catch {
    return { cards: [], trouble: 'unreadable' }
  }
}
