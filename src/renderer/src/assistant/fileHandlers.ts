import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { documentExtensionOf, isDocumentExtension } from '@shared/domain/document'
import { FOLDER_ROOT } from '@shared/domain/folder'
import {
  projectFailureIn,
  projectPathFor,
  projectPickerFolder,
  projectsByCreation,
  type Project,
  type ProjectOpenFailure,
} from '@shared/domain/project'
import { messageOf } from '@shared/guards'
import type { StudioBridge } from '@shared/ipc'
import { getBridge } from '@/services/bridge'
import { openProjectFile, type FileOpening } from '@/helpers/openProjectFile'
import { documentAtPath, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { withBridge, type ActionHandlers } from './actionHandler'
import { boolOf, textOf, textsOf } from './actionInputs'

/**
 * The project folder, walked and changed from outside the window.
 *
 * Every one of these goes through the channel the Explorer uses, so a batch lands in the file
 * undo stack and in the activity journal exactly as a drag would.
 */

/**
 * Runs against the OPEN project, refusing for the right one of two reasons.
 *
 * The two were answered as `noBridge` together at first, which told a client its window was
 * unreachable when the real answer was that a relative path had nothing to be relative to.
 */
const NO_PROJECT =
  'no project is open, and a path is relative to one — projects.list answers the ones this machine ' +
  'knows, project.open opens one and project.create makes one'

function inProject(run: (bridge: StudioBridge) => Promise<unknown>): Promise<ActionOutcome> {
  if (!getBridge())
    return Promise.resolve(
      refused('noBridge', 'this window is not connected to the studio process'),
    )
  if (!useProject.getState().project) return Promise.resolve(refused('noProject', NO_PROJECT))

  return withBridge(run)
}

/**
 * The same, followed by the relist a write owes its next reader.
 *
 * The store learns of a batch through an event, but a client calling `files.list` in the very
 * next message would otherwise read the listing from before its own move — the round trip is
 * faster than the watcher.
 */
async function changing(run: (bridge: StudioBridge) => Promise<unknown>): Promise<ActionOutcome> {
  const outcome = await inProject(run)
  if (outcome.ok) await useDocuments.getState().relist('own-write')

  return outcome
}

/** Every path-taking action needs at least one; the registry holds the list to non-empty. */
function moving(
  input: Record<string, unknown>,
  run: (bridge: StudioBridge, paths: string[], folder: string) => Promise<unknown>,
): Promise<ActionOutcome> {
  return changing(bridge =>
    run(bridge, textsOf(input, 'paths'), textOf(input, 'folder') ?? FOLDER_ROOT),
  )
}

async function facts(input: Record<string, unknown>): Promise<ActionOutcome> {
  const outcome = await inProject(bridge =>
    bridge.project.fileFacts(textOf(input, 'path') ?? FOLDER_ROOT),
  )

  // `null` is the channel's answer for an entry that is not there. `notFound` rather than
  // `badInput`: the path was a well-formed string, and a client told otherwise retries the call.
  return outcome.ok && outcome.data === null
    ? refused(
        'notFound',
        `nothing at "${textOf(input, 'path') ?? FOLDER_ROOT}" in the open project — files.list walks a folder and files.search finds by name`,
      )
    : outcome
}

/**
 * The endings that are refusals. The three that are not — a tab, an editor, another program —
 * answer `ok` and NAME which one: a model told `ok` alone reports a tab that is not there.
 */
const REFUSAL_OF_OPENING: Record<FileOpening, ActionOutcome | null> = {
  document: null,
  asset: null,
  system: null,
  folder: refused(
    'badInput',
    '"path" names a folder, and this opens a file — files.list walks one instead',
  ),
  missing: refused(
    'notFound',
    'nothing at that path in the open project — files.list answers what is there, and files.search finds by name',
  ),
  unreachable: refused('noBridge', 'this window is not connected to the studio process'),
  failed: refused('failed', 'the studio could not open that file — the journal holds why'),
}

async function openFile(input: Record<string, unknown>): Promise<ActionOutcome> {
  const path = textOf(input, 'path')
  if (path === null)
    return refused(
      'badInput',
      '"path" is wanted — a path relative to the open project, as files.list answers it',
    )
  if (!useProject.getState().project) return refused('noProject', NO_PROJECT)

  /**
   * The same re-read `document.open` does — a listing the client holds may predate a file that
   * has since arrived — but only where the answer could change: a listing holds documents alone,
   * so re-walking the project for a `.png` costs one head per document and can find nothing.
   */
  if (
    isDocumentExtension(documentExtensionOf(path)) &&
    !documentAtPath(useDocuments.getState(), path)
  ) {
    await useDocuments.getState().relist('own-write')
  }

  const opening = await openProjectFile(path)
  return REFUSAL_OF_OPENING[opening] ?? { ok: true, data: { opened: opening } }
}

async function openProject(input: Record<string, unknown>): Promise<ActionOutcome> {
  const path = textOf(input, 'path')
  if (path === null)
    return refused(
      'badInput',
      '"path" is wanted — the whole path of a project folder, as projects.list answers it',
    )

  return (await useProject.getState().open(path))
    ? { ok: true }
    : refused(
        'badInput',
        `no project opened at "${path}" — projects.list answers the ones this machine knows, each with its path`,
      )
}

async function closeProject(): Promise<ActionOutcome> {
  const { project, close } = useProject.getState()
  if (!project)
    return refused('noProject', 'no project is open — projects.list answers what there is to open')

  // Same shape as `document.close`, and for the same reason: the store raises the only question
  // that knows whether any work is at stake, so this action commits `none` and answers its no.
  return (await close())
    ? { ok: true }
    : refused(
        'declined',
        'the person at the screen kept the project open — a generation may be running, or a document may hold unsaved work',
      )
}

/**
 * What each verdict asks for, in the words a model repairs from. `holds-projects` is the one a
 * person meets: a folder OF projects is not itself a project, and the studio names the new one
 * inside it — the model only has to say the name.
 */
const CREATE_REFUSALS: Record<ProjectOpenFailure, string> = {
  'holds-projects':
    'that folder already holds projects, so it is a folder OF projects rather than one itself — call this again with just the NAME of the new project, and the studio puts it inside where it keeps them',
  nested:
    'that folder sits inside a project, and a project inside a project gives the catalogue two owners for the same files — name one that is not under a project',
  'not-a-project':
    'that folder could not be read as a place for a project — name another one, or give just the NAME of the new project and let the studio place it',
  unreadable:
    "that folder holds a project whose manifest cannot be read — it is not a place to create in, and repairing it is the person's to do",
  'too-new':
    'that folder holds a project written by a newer studio than this one, which cannot create over it — name another folder',
}

async function createProject(input: Record<string, unknown>): Promise<ActionOutcome> {
  // Bare on purpose: `name` is `required`, so `runAction` refuses a call without it — and names
  // the field — before this ever runs.
  const asked = textOf(input, 'name')
  if (asked === null)
    return refused(
      'badInput',
      '"name" is wanted — what to call the new project. "folder" says where to put it, and the studio uses where this person keeps projects when it is left out',
    )

  /**
   * 🛑 A NAME is enough, and that is the whole point: asked for an absolute path, the model asked
   * the person for one — which is a line nobody wants to type. Where this machine keeps projects
   * is the studio's to know, never the model's.
   */
  const { projectsFolder, recentProjects } = useSettings.getState().settings.storage
  const within = textOf(input, 'folder') ?? projectPickerFolder(projectsFolder, recentProjects)
  const path = projectPathFor(asked, within ?? undefined)
  // The first project of a machine: nothing has been created yet, so there is no folder to put a
  // name under. Answered rather than guessed — `~/Documents` is a place nobody asked for.
  if (path === undefined) {
    return refused(
      'badInput',
      'no folder is known to put a project in yet, and none can be guessed. Give "folder" a whole ' +
        'absolute path this time.',
    )
  }

  // Through the store, which is what makes this the FOURTH way out of a project rather than the
  // one that slipped past its questions: it left the open project without asking about the
  // generations running in it, nor about any document holding unsaved work.
  let created: Project | null
  try {
    created = await useProject.getState().createAt(path)
  } catch (error) {
    /**
     * 🛑 The folder's own refusal, said in a sentence the model can repair from. Left to throw it
     * reached the turn as "the assistant could not answer that one", over a studio that had
     * written the reason in its journal — and « crée un projet jeu1 » ended there.
     */
    const why = projectFailureIn(messageOf(error))
    return refused('failed', why === null ? messageOf(error) : CREATE_REFUSALS[why])
  }
  // `declined` rather than `badInput`, and it covers both nos: the question on the way out, and
  // the main process asking about a folder that already holds files. A client told its input was
  // wrong would retry a path that was never the problem.
  if (!created)
    return refused(
      'declined',
      'the new project was turned down — either by the person at the screen, or because that folder already holds files',
    )

  return { ok: true, data: created }
}

export const FILE_HANDLERS: ActionHandlers = {
  // 🛑 `projectsByCreation`, the order the two shelves the person LOOKS at are drawn in — the
  // stored order reshuffles on every opening, and « the first one » must mean one row.
  'projects.list': () => ({
    ok: true,
    data: projectsByCreation(useSettings.getState().settings.storage.recentProjects).map(one => ({
      name: one.name,
      path: one.path,
    })),
  }),

  'project.open': openProject,
  'project.close': closeProject,
  'project.create': createProject,
  'file.facts': facts,
  'file.open': openFile,

  'files.list': input =>
    inProject(bridge =>
      bridge.project.listFolder(textOf(input, 'folder') ?? FOLDER_ROOT, boolOf(input, 'hidden')),
    ),

  'files.search': input =>
    inProject(bridge =>
      bridge.project.searchFolder(textOf(input, 'query') ?? '', boolOf(input, 'hidden')),
    ),

  'files.move': input =>
    moving(input, (bridge, paths, folder) => bridge.project.moveFiles(paths, folder)),

  // `cut: false` is the copy. The channel is the Explorer's paste, which is why it takes a flag
  // rather than there being two of them.
  'files.copy': input =>
    moving(input, (bridge, paths, folder) => bridge.project.pasteFiles(paths, folder, false)),

  'files.duplicate': input =>
    changing(bridge => bridge.project.duplicateFiles(textsOf(input, 'paths'))),

  'files.trash': input => changing(bridge => bridge.project.trashFiles(textsOf(input, 'paths'))),

  'file.rename': input =>
    changing(bridge =>
      bridge.project.renameFile(textOf(input, 'path') ?? '', textOf(input, 'name') ?? ''),
    ),

  'folder.new': input =>
    changing(bridge =>
      bridge.project.newFolder(textOf(input, 'folder') ?? '', textOf(input, 'name') ?? ''),
    ),

  'files.undoFileOperation': () => changing(bridge => bridge.project.undoFile()),

  'files.redoFileOperation': () => changing(bridge => bridge.project.redoFile()),

  'files.readUndoStack': () => inProject(bridge => bridge.project.fileHistory()),

  'file.reveal': input =>
    inProject(bridge => bridge.project.revealFile(textOf(input, 'path') ?? '')),

  /**
   * Through the store rather than the channel, and not `inProject`: the path is absolute and
   * names a project that need not be the open one. The store is what puts the new name on the
   * open project and in the recent list — the broadcast behind the channel reaches OTHER windows,
   * so the one that served this call would have kept the old name for good.
   */
  'project.rename': async input => {
    const renamed = await useProject
      .getState()
      .rename(textOf(input, 'path') ?? '', textOf(input, 'name') ?? '')

    return renamed
      ? { ok: true }
      : refused(
          'failed',
          '"path" must name a project folder this machine knows and "name" must be free — projects.list answers the ones it knows',
        )
  },
}
