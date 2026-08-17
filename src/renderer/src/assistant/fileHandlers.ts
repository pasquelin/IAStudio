import type { ActionOutcome, ActionRefusal } from '@shared/domain/assistant'
import type { FileOutcome } from '@shared/domain/fileOp'
import { FOLDER_ROOT } from '@shared/domain/folder'
import { getBridge } from '@/services/bridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import type { ActionHandlers } from './actionHandler'
import { boolOf, textOf, textsOf } from './actionInputs'

/**
 * The project folder, walked and changed from outside the window.
 *
 * Every one of these goes through the same channel the Explorer uses, so a batch lands in the
 * file undo stack and in the activity journal exactly as a drag would. Nothing here writes to
 * disk on its own.
 */

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

/**
 * A file operation's answer, and the relist that has to follow it.
 *
 * The store learns of a batch through an event, but a client that calls `files.list` in the very
 * next message would otherwise read the listing from before its own move — the round trip is
 * faster than the watcher. Awaiting it here is what makes two consecutive calls agree.
 */
async function settled(outcome: FileOutcome): Promise<ActionOutcome> {
  await useDocuments.getState().relist('own-write')
  return { ok: true, data: outcome }
}

function withProject<T>(run: (bridge: NonNullable<ReturnType<typeof getBridge>>) => T): T | null {
  const bridge = getBridge()
  return bridge && useProject.getState().project ? run(bridge) : null
}

async function listFolder(input: Record<string, unknown>): Promise<ActionOutcome> {
  const entries = withProject(bridge =>
    bridge.project.listFolder(textOf(input, 'folder') ?? FOLDER_ROOT, boolOf(input, 'hidden')),
  )
  return entries ? { ok: true, data: await entries } : refused('noBridge')
}

async function searchFiles(input: Record<string, unknown>): Promise<ActionOutcome> {
  const query = textOf(input, 'query')
  if (query === null) return refused('badInput')

  const entries = withProject(bridge => bridge.project.searchFolder(query, boolOf(input, 'hidden')))
  return entries ? { ok: true, data: await entries } : refused('noBridge')
}

async function move(input: Record<string, unknown>): Promise<ActionOutcome> {
  const paths = textsOf(input, 'paths')
  const folder = textOf(input, 'folder')
  if (paths.length === 0 || folder === null) return refused('badInput')

  const outcome = withProject(bridge => bridge.project.moveFiles(paths, folder))
  return outcome ? settled(await outcome) : refused('noBridge')
}

async function copy(input: Record<string, unknown>): Promise<ActionOutcome> {
  const paths = textsOf(input, 'paths')
  const folder = textOf(input, 'folder')
  if (paths.length === 0 || folder === null) return refused('badInput')

  // `cut: false` is the copy. The channel is the Explorer's paste, which is why it takes a flag
  // rather than there being two of them.
  const outcome = withProject(bridge => bridge.project.pasteFiles(paths, folder, false))
  return outcome ? settled(await outcome) : refused('noBridge')
}

async function duplicate(input: Record<string, unknown>): Promise<ActionOutcome> {
  const paths = textsOf(input, 'paths')
  if (paths.length === 0) return refused('badInput')

  const outcome = withProject(bridge => bridge.project.duplicateFiles(paths))
  return outcome ? settled(await outcome) : refused('noBridge')
}

async function trash(input: Record<string, unknown>): Promise<ActionOutcome> {
  const paths = textsOf(input, 'paths')
  if (paths.length === 0) return refused('badInput')

  const outcome = withProject(bridge => bridge.project.trashFiles(paths))
  return outcome ? settled(await outcome) : refused('noBridge')
}

async function renameFile(input: Record<string, unknown>): Promise<ActionOutcome> {
  const path = textOf(input, 'path')
  const name = textOf(input, 'name')
  if (path === null || name === null) return refused('badInput')

  const outcome = withProject(bridge => bridge.project.renameFile(path, name))
  return outcome ? settled(await outcome) : refused('noBridge')
}

async function newFolder(input: Record<string, unknown>): Promise<ActionOutcome> {
  const folder = textOf(input, 'folder')
  const name = textOf(input, 'name')
  if (folder === null || name === null) return refused('badInput')

  const outcome = withProject(bridge => bridge.project.newFolder(folder, name))
  return outcome ? settled(await outcome) : refused('noBridge')
}

async function facts(input: Record<string, unknown>): Promise<ActionOutcome> {
  const path = textOf(input, 'path')
  if (path === null) return refused('badInput')

  const found = withProject(bridge => bridge.project.fileFacts(path))
  if (!found) return refused('noBridge')

  // `null` is the channel's answer for an entry that is not there, and a refusal says so rather
  // than handing back a null a client would have to interpret.
  return (await found) ? { ok: true, data: await found } : refused('badInput')
}

async function openProject(input: Record<string, unknown>): Promise<ActionOutcome> {
  const path = textOf(input, 'path')
  if (path === null) return refused('badInput')

  return (await useProject.getState().open(path)) ? { ok: true } : refused('badInput')
}

async function createProject(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  const path = textOf(input, 'path')
  if (!bridge) return refused('noBridge')
  if (path === null) return refused('badInput')

  const created = await bridge.project.create(path)
  // Created and then opened, because a project nobody is in is a folder: every other action of
  // this family reads `useProject`, and would refuse on the very thing that was just made.
  if (!created || !(await useProject.getState().open(created.path))) return refused('badInput')

  return { ok: true, data: created }
}

export const FILE_HANDLERS: ActionHandlers = {
  'project.open': openProject,
  'project.create': createProject,
  'files.list': listFolder,
  'files.search': searchFiles,
  'files.move': move,
  'files.copy': copy,
  'files.duplicate': duplicate,
  'files.trash': trash,
  'file.rename': renameFile,
  'file.facts': facts,
  'folder.new': newFolder,
}
