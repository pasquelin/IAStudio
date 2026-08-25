import type { ActionOutcome } from '@shared/domain/assistant'
import { pathBaseNameOf } from '@shared/domain/fileName'
import { matchesWords, searchWords } from '@shared/text'
import { answered, done, front, refused, type Bench, type StudioFile } from './bench'
import { paths, text, type Input } from './inputs'

/** The project folder and the documents open over it — sections 1 to 5, and the undo of 29. */

const parentOf = (path: string): string => path.split('/').slice(0, -1).join('/')

const shown = (one: StudioFile): unknown => ({ path: one.path, kind: one.kind })

const holds = (bench: Bench, path: string): StudioFile | undefined =>
  bench.files.find(one => one.path === path)

/** Everything under a folder, itself included — what moving or binning one has to carry. */
const beneath = (bench: Bench, path: string): StudioFile[] =>
  bench.files.filter(one => one.path === path || one.path.startsWith(`${path}/`))

const joined = (folder: string, name: string): string =>
  folder === '' ? name : `${folder}/${name}`

/** A path and everything beneath it, moved in one go. */
function renamed(bench: Bench, from: string, to: string): void {
  for (const one of beneath(bench, from)) {
    one.path = one.path === from ? to : one.path.replace(`${from}/`, `${to}/`)
  }
}

/**
 * 🛑 The FILES alone, never the open documents: `files.undo` reaches `project.undoFile()` and
 * reverses file operations. A bench rolling documents back too made a `folder.new` followed by
 * an undo wipe every edit of the session, which reads as a model failure.
 */
export function remember(bench: Bench): void {
  bench.past.push({ files: bench.files.map(one => ({ ...one })) })
  bench.future = []
}

function step(bench: Bench, from: 'past' | 'future'): ActionOutcome {
  const taken = bench[from].pop()
  if (!taken) return refused('badInput')

  bench[from === 'past' ? 'future' : 'past'].push({ files: bench.files })
  bench.files = taken.files
  return done
}

export function fileAction(bench: Bench, action: string, input: Input): ActionOutcome | null {
  switch (action) {
    case 'files.search': {
      const words = searchWords(text(input, 'query'))
      return answered(bench.files.filter(one => matchesWords(one.path, words)).map(shown))
    }

    case 'files.list': {
      const folder = text(input, 'folder')
      return answered(bench.files.filter(one => parentOf(one.path) === folder).map(shown))
    }

    case 'file.facts': {
      const found = holds(bench, text(input, 'path'))
      return found ? answered({ path: found.path, kind: found.kind }) : refused('notFound')
    }

    case 'folder.new': {
      const parent = text(input, 'folder')
      const name = text(input, 'name')
      if (name === '') return refused('badInput')

      const path = joined(parent, name)
      if (holds(bench, path)) return refused('badInput')

      remember(bench)
      bench.files.push({ path, kind: 'folder' })
      return answered({ path })
    }

    /**
     * 🛑 `files.duplicate` takes NO destination: the copy lands beside the original, and « dans ce
     * dossier » is a `files.move` afterwards. A bench that accepted a `to` let a plan skip the
     * second call and scored a file the studio would have left where it was.
     */
    case 'files.duplicate': {
      const wanted = paths(input)
      if (wanted.length === 0) return refused('badInput')

      remember(bench)
      const made: string[] = []
      for (const from of wanted) {
        const found = holds(bench, from)
        if (!found || found.kind !== 'file') continue

        const to = joined(parentOf(from), `copie de ${pathBaseNameOf(from)}`)
        if (holds(bench, to)) continue

        bench.files.push({ path: to, kind: 'file' })
        made.push(to)
      }
      return made.length > 0 ? answered({ paths: made }) : refused('notFound')
    }

    case 'files.copy': {
      const wanted = paths(input)
      const folder = text(input, 'folder')
      if (wanted.length === 0) return refused('badInput')

      remember(bench)
      for (const from of wanted) {
        const found = holds(bench, from)
        if (!found) continue

        const to = joined(folder, pathBaseNameOf(from))
        if (!holds(bench, to)) bench.files.push({ path: to, kind: found.kind })
      }
      return done
    }

    case 'file.rename': {
      const from = text(input, 'path')
      const found = holds(bench, from)
      const name = text(input, 'name')
      if (!found || name === '') return refused('notFound')

      const to = joined(parentOf(from), name)
      remember(bench)
      renamed(bench, from, to)
      for (const one of bench.documents) if (one.path === from) one.path = to
      return answered({ path: to })
    }

    case 'files.move': {
      const wanted = paths(input)
      const folder = text(input, 'folder')
      if (wanted.length === 0) return refused('badInput')
      if (folder !== '' && !holds(bench, folder)) return refused('notFound')

      remember(bench)
      for (const from of wanted) {
        const found = holds(bench, from)
        if (!found) continue

        renamed(
          bench,
          from,
          folder === '' ? pathBaseNameOf(from) : joined(folder, pathBaseNameOf(from)),
        )
      }
      return done
    }

    case 'files.trash': {
      const wanted = paths(input)
      if (wanted.length === 0) return refused('badInput')

      remember(bench)
      for (const path of wanted) {
        const gone = beneath(bench, path)
        bench.files = bench.files.filter(one => !gone.includes(one))
      }
      return done
    }

    case 'files.undo':
      return step(bench, 'past')

    case 'files.redo':
      return step(bench, 'future')

    case 'files.history':
      return answered(bench.past.map((_, at) => ({ at })))

    case 'documents.list':
      return answered(
        bench.documents.map(one => ({
          id: one.id,
          title: one.title,
          workspace: one.space,
          active: one.id === bench.frontId,
          modified: one.modified,
        })),
      )

    case 'document.save': {
      const open = front(bench)
      if (!open) return refused('wrongSurface')

      open.modified = false
      return done
    }

    case 'document.rename': {
      const open = bench.documents.find(one => one.id === text(input, 'documentId'))
      const title = text(input, 'title')
      if (!open || title === '') return refused('badInput')

      open.title = title
      return done
    }

    case 'activity.recent':
      return answered([])

    case 'project.rename': {
      const name = text(input, 'name')
      if (name === '' || text(input, 'path') === '') return refused('badInput')

      bench.projectName = name
      return done
    }

    default:
      return null
  }
}
