import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { StudioBridge } from '@shared/ipc'
import { withBridge, type ActionHandlers } from './actionHandler'
import { boolOf, numberOf, oneOf, textOf, textsOf } from './actionInputs'

/**
 * The project's repository, as far as this machine.
 *
 * Every write answers with the state it LEFT — the panel's own contract — so a client never has
 * to read the status back after acting.
 */

const DEFAULT_LOG = 20

/** The two sides of a conflict, spelled here and in the registry — the port takes a bare union. */
const CONFLICT_SIDES: readonly ('ours' | 'theirs')[] = ['ours', 'theirs']

/** One git call, its answer handed back whole. */
const git = (run: (port: StudioBridge['git']) => Promise<unknown>): Promise<ActionOutcome> =>
  withBridge(bridge => run(bridge.git))

export const GIT_HANDLERS: ActionHandlers = {
  'git.status': () => git(port => port.read()),
  'git.branches': () => git(port => port.branches()),
  'git.stashes': () => git(port => port.stashes()),
  'git.init': () => git(port => port.init()),

  'git.log': input =>
    git(port => port.log(numberOf(input, 'limit') ?? DEFAULT_LOG, numberOf(input, 'skip') ?? 0)),

  'git.listCommitFiles': input => git(port => port.commitFiles(textOf(input, 'hash') ?? '')),

  // A null commit is the working tree against the last recorded version, which is what a client
  // that named none means — not a missing argument.
  'git.diff': input => git(port => port.diff(textOf(input, 'path') ?? '', textOf(input, 'commit'))),

  'git.stage': input => git(port => port.stage(textsOf(input, 'paths'))),
  'git.unstage': input => git(port => port.unstage(textsOf(input, 'paths'))),
  'git.restore': input => git(port => port.restore(textsOf(input, 'paths'))),

  'git.commit': input =>
    git(port => port.commit(textOf(input, 'message') ?? '', boolOf(input, 'amend'))),

  'git.createBranch': input => git(port => port.createBranch(textOf(input, 'name') ?? '')),
  'git.checkout': input => git(port => port.checkout(textOf(input, 'name') ?? '')),
  'git.stash': input => git(port => port.stash(textOf(input, 'message') ?? '')),
  'git.stashPop': input => git(port => port.stashPop(numberOf(input, 'index') ?? 0)),

  'git.tag': input =>
    git(port => port.tag(textOf(input, 'name') ?? '', textOf(input, 'commit') ?? '')),

  'git.stashDrop': input => git(port => port.stashDrop(numberOf(input, 'index') ?? 0)),
  'git.abortMerge': () => git(port => port.abortMerge()),
  'git.remotes': () => git(port => port.remotes()),

  'git.addRemote': input =>
    git(port => port.addRemote(textOf(input, 'name') ?? '', textOf(input, 'url') ?? '')),

  'git.resolve': input => {
    const side = oneOf(input, 'side', CONFLICT_SIDES)
    return side
      ? git(port => port.resolve(textsOf(input, 'paths'), side))
      : Promise.resolve(refused('badInput'))
  },

  'git.fetch': () => git(port => port.fetch()),
  'git.pull': () => git(port => port.pull()),
  'git.push': input => git(port => port.push(boolOf(input, 'setUpstream'))),
}
