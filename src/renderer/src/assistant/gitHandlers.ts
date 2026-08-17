import type { ActionOutcome, ActionRefusal } from '@shared/domain/assistant'
import type { StudioBridge } from '@shared/ipc'
import { getBridge } from '@/services/bridge'
import type { ActionHandlers } from './actionHandler'
import { boolOf, numberOf, textOf, textsOf } from './actionInputs'

/**
 * The repository, as far as this machine.
 *
 * Every write answers with the state it LEFT — that is the panel's own contract — so a client
 * never has to read the status back after acting, and two calls can never disagree about what
 * the tree holds.
 */

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

const DEFAULT_LOG = 20

type GitPort = StudioBridge['git']

/** Runs one git call and hands its answer back whole — every one of them answers the state. */
async function answered(run: (port: GitPort) => Promise<unknown>): Promise<ActionOutcome> {
  const port = getBridge()?.git
  if (!port) return refused('noBridge')

  return { ok: true, data: await run(port) }
}

function pathsOf(input: Record<string, unknown>): string[] | null {
  const paths = textsOf(input, 'paths')
  return paths.length > 0 ? paths : null
}

export const GIT_HANDLERS: ActionHandlers = {
  'git.status': () => answered(port => port.read()),
  'git.branches': () => answered(port => port.branches()),
  'git.stashes': () => answered(port => port.stashes()),
  'git.init': () => answered(port => port.init()),

  'git.log': input =>
    answered(port =>
      port.log(numberOf(input, 'limit') ?? DEFAULT_LOG, numberOf(input, 'skip') ?? 0),
    ),

  'git.commitFiles': input => {
    const hash = textOf(input, 'hash')
    return hash === null ? refused('badInput') : answered(port => port.commitFiles(hash))
  },

  'git.diff': input => {
    const path = textOf(input, 'path')
    // `null` is the working tree against the last recorded version, which is what a client that
    // named no commit means — not a missing argument.
    return path === null
      ? refused('badInput')
      : answered(port => port.diff(path, textOf(input, 'commit')))
  },

  'git.stage': input => {
    const paths = pathsOf(input)
    return paths ? answered(port => port.stage(paths)) : refused('badInput')
  },

  'git.unstage': input => {
    const paths = pathsOf(input)
    return paths ? answered(port => port.unstage(paths)) : refused('badInput')
  },

  'git.restore': input => {
    const paths = pathsOf(input)
    return paths ? answered(port => port.restore(paths)) : refused('badInput')
  },

  'git.commit': input => {
    const message = textOf(input, 'message')
    return message === null
      ? refused('badInput')
      : answered(port => port.commit(message, boolOf(input, 'amend')))
  },

  'git.createBranch': input => {
    const name = textOf(input, 'name')
    return name === null ? refused('badInput') : answered(port => port.createBranch(name))
  },

  'git.checkout': input => {
    const name = textOf(input, 'name')
    return name === null ? refused('badInput') : answered(port => port.checkout(name))
  },

  'git.stash': input => answered(port => port.stash(textOf(input, 'message') ?? '')),

  'git.stashPop': input => {
    const index = numberOf(input, 'index')
    return index === null ? refused('badInput') : answered(port => port.stashPop(index))
  },

  'git.tag': input => {
    const name = textOf(input, 'name')
    const commit = textOf(input, 'commit')
    return name === null || commit === null
      ? refused('badInput')
      : answered(port => port.tag(name, commit))
  },
}
