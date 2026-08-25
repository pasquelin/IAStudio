import type { ActionOutcome } from '@shared/domain/assistant'
import { answered, done, refused, type Bench } from './bench'
import { number, paths, text, type Input } from './inputs'

/**
 * The project under version control — section 58.
 *
 * 🛑 Every gesture but `git.init` refuses on an untracked project, as the real handlers do: a
 * bench answering `ok` on a folder git never saw would score « enregistre une version » on
 * nothing at all.
 */

const OPEN_TO_UNTRACKED = ['git.init', 'git.status']

export function gitAction(bench: Bench, action: string, input: Input): ActionOutcome | null {
  if (!action.startsWith('git.')) return null

  const git = bench.git
  if (!git.tracked && !OPEN_TO_UNTRACKED.includes(action)) return refused('badInput')

  switch (action) {
    case 'git.status':
      return answered({
        tracked: git.tracked,
        branch: git.branch,
        changed: git.changed,
        staged: git.staged,
        conflicts: git.conflicts,
        merging: git.merging,
      })

    case 'git.init':
      git.tracked = true
      return done

    case 'git.log':
      return answered(
        git.commits.map((one, at) => ({ hash: `commit-${at + 1}`, message: one.message })),
      )

    case 'git.commitFiles': {
      const at = Number(text(input, 'hash').replace('commit-', '')) - 1
      const found = git.commits[at]
      return found ? answered({ files: found.files }) : refused('notFound')
    }

    case 'git.diff':
      return text(input, 'path') === ''
        ? refused('badInput')
        : answered({ path: text(input, 'path'), changed: true })

    case 'git.branches':
      return answered({ current: git.branch, branches: git.branches })

    case 'git.stashes':
      return answered(git.stashes.map((one, at) => ({ index: at, message: one.message })))

    case 'git.stage': {
      const wanted = paths(input)
      if (wanted.length === 0) return refused('badInput')

      for (const one of wanted) if (!git.staged.includes(one)) git.staged.push(one)
      return done
    }

    case 'git.unstage': {
      const wanted = paths(input)
      if (wanted.length === 0) return refused('badInput')

      git.staged = git.staged.filter(one => !wanted.includes(one))
      return done
    }

    // 🛑 What was not recorded is GONE — the edit leaves `changed`, which is the one thing
    // `unstage` never touches. Modelled the same way, the two were indistinguishable.
    case 'git.restore': {
      const wanted = paths(input)
      if (wanted.length === 0) return refused('badInput')

      git.staged = git.staged.filter(one => !wanted.includes(one))
      git.changed = git.changed.filter(one => !wanted.includes(one))
      git.conflicts = git.conflicts.filter(one => !wanted.includes(one))
      return done
    }

    case 'git.commit': {
      const message = text(input, 'message')
      if (message === '') return refused('badInput')

      if (input['amend'] === true && git.commits.length > 0) git.commits.pop()
      git.commits.push({ message, files: [...git.staged] })
      git.changed = git.changed.filter(one => !git.staged.includes(one))
      git.staged = []
      return done
    }

    case 'git.createBranch': {
      const name = text(input, 'name')
      if (name === '') return refused('badInput')

      if (!git.branches.includes(name)) git.branches.push(name)
      return done
    }

    case 'git.checkout': {
      const name = text(input, 'name')
      if (!git.branches.includes(name)) return refused('notFound')

      git.branch = name
      return done
    }

    case 'git.stash':
      git.stashes.push({
        message: text(input, 'message') || 'Travail en cours',
        files: git.changed,
      })
      git.changed = []
      git.staged = []
      return done

    // Popping BRINGS THE WORK BACK; dropping throws it away. Only the second half tells them
    // apart, and a bench splicing the list for both scored either one on the other.
    case 'git.stashPop': {
      const at = number(input, 'index')
      const taken = at === null ? undefined : git.stashes[at]
      if (!taken) return refused('badInput')

      git.stashes.splice(at ?? 0, 1)
      git.changed = [...git.changed, ...taken.files]
      return done
    }

    case 'git.stashDrop': {
      const at = number(input, 'index')
      if (at === null || at < 0 || at >= git.stashes.length) return refused('badInput')

      git.stashes.splice(at, 1)
      return done
    }

    case 'git.tag': {
      const name = text(input, 'name')
      if (name === '' || text(input, 'commit') === '') return refused('badInput')

      git.tags.push(name)
      return done
    }

    case 'git.resolve': {
      const wanted = paths(input)
      const side = text(input, 'side')
      if (wanted.length === 0 || (side !== 'ours' && side !== 'theirs')) return refused('badInput')

      git.conflicts = git.conflicts.filter(one => !wanted.includes(one))
      if (git.conflicts.length === 0) git.merging = false
      return done
    }

    case 'git.abortMerge':
      if (!git.merging) return refused('badInput')

      git.merging = false
      git.conflicts = []
      return done

    case 'git.remotes':
      return answered(git.remotes.map(one => ({ name: 'origin', url: one })))

    case 'git.addRemote': {
      const url = text(input, 'url')
      if (text(input, 'name') === '' || url === '') return refused('badInput')

      git.remotes.push(url)
      return done
    }

    case 'git.fetch':
      git.fetched = true
      return done

    case 'git.pull':
      git.pulled = true
      return done

    case 'git.push':
      git.pushed = true
      return done

    default:
      return null
  }
}
