import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileFacts } from '@shared/domain/fileInfo'
import type { FileOutcome } from '@shared/domain/fileOp'
import { FOLDER_ROOT, type FolderEntry } from '@shared/domain/folder'
import { installFakeBridge, type BridgeOverrides } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { runAction } from './executor'

const WHEN = '2026-08-17T10:00:00.000Z'
const BATCH: FileOutcome = { done: [], refused: [], batch: 'batch-1' }

const relist = vi.fn(async () => {})

function withProject(overrides: BridgeOverrides = {}): void {
  installFakeBridge(overrides)
  useProject.setState({
    project: {
      path: '/tmp/Film',
      manifest: { version: 1, name: 'Film', createdAt: WHEN, updatedAt: WHEN },
    },
  })
}

beforeEach(() => {
  relist.mockClear()
  useDocuments.setState({ relist })
  withProject()
})

describe('walking the project folder', () => {
  it('lists a folder, and the project root when none is named', async () => {
    const entry: FolderEntry = { path: 'Plans', name: 'Plans', kind: 'folder' }
    const listFolder = vi.fn(async () => [entry])
    withProject({ project: { listFolder } })

    expect(await runAction('files.list', { folder: 'Plans' })).toEqual({ ok: true, data: [entry] })
    expect(listFolder).toHaveBeenCalledWith('Plans', false)

    await runAction('files.list', {})
    expect(listFolder).toHaveBeenCalledWith('', false)
  })

  it('searches the whole project by name', async () => {
    const searchFolder = vi.fn(async () => [])
    withProject({ project: { searchFolder } })

    await runAction('files.search', { query: 'niveau', hidden: true })
    expect(searchFolder).toHaveBeenCalledWith('niveau', true)
  })

  it('reads one entry’s facts, and refuses a path the disk does not hold', async () => {
    const facts: FileFacts = { kind: 'file', bytes: 12, createdAt: WHEN, modifiedAt: WHEN }
    withProject({ project: { fileFacts: vi.fn(async () => facts) } })
    expect(await runAction('file.facts', { path: 'Plans/a.png' })).toEqual({
      ok: true,
      data: facts,
    })

    withProject({ project: { fileFacts: vi.fn(async () => null) } })
    expect(await runAction('file.facts', { path: 'Plans/gone.png' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  /**
   * Its own refusal, not `noBridge`: the two were answered together at first, which told a
   * client its window was unreachable when the real answer was that a relative path had nothing
   * to be relative to — and the two are fixed by opposite gestures.
   */
  it('refuses everything while no project is open, and says which of the two it is', async () => {
    installFakeBridge()
    useProject.setState({ project: null })

    expect(await runAction('files.list', {})).toEqual({ ok: false, refusal: 'noProject' })
    expect(await runAction('files.trash', { paths: ['a.png'] })).toEqual({
      ok: false,
      refusal: 'noProject',
    })
  })
})

describe('changing the project folder', () => {
  /**
   * The store learns of a batch through an event, but a client calling `files.list` in the very
   * next message would read the listing from before its own move — the round trip beats the
   * watcher. Awaiting the relist is what makes two consecutive calls agree.
   */
  it('re-reads the folder before answering, so the next listing sees the change', async () => {
    const moveFiles = vi.fn(async () => BATCH)
    withProject({ project: { moveFiles } })

    expect(await runAction('files.move', { paths: ['a.png'], folder: 'Plans' })).toEqual({
      ok: true,
      data: BATCH,
    })
    expect(moveFiles).toHaveBeenCalledWith(['a.png'], 'Plans')
    expect(relist).toHaveBeenCalledWith('own-write')
  })

  /**
   * The project ROOT is spelled `''`, and a required text may not be blank — so while `folder`
   * was required there was no spelling of "up to the root" a client could get through at all.
   */
  it('moves to the project root when no folder is named', async () => {
    const moveFiles = vi.fn(async () => BATCH)
    const newFolder = vi.fn(async () => BATCH)
    withProject({ project: { moveFiles, newFolder } })

    await runAction('files.move', { paths: ['Plans/a.png'] })
    await runAction('folder.new', { name: 'Nuit' })

    expect(moveFiles).toHaveBeenCalledWith(['Plans/a.png'], FOLDER_ROOT)
    expect(newFolder).toHaveBeenCalledWith(FOLDER_ROOT, 'Nuit')
  })

  it('copies through the Explorer’s paste, which is the same channel with the cut flag down', async () => {
    const pasteFiles = vi.fn(async () => BATCH)
    withProject({ project: { pasteFiles } })

    await runAction('files.copy', { paths: ['a.png'], folder: 'Plans' })
    expect(pasteFiles).toHaveBeenCalledWith(['a.png'], 'Plans', false)
  })

  it('bins, duplicates, renames and makes folders through their own channels', async () => {
    const trashFiles = vi.fn(async () => BATCH)
    const duplicateFiles = vi.fn(async () => BATCH)
    const renameFile = vi.fn(async () => BATCH)
    const newFolder = vi.fn(async () => BATCH)
    withProject({ project: { trashFiles, duplicateFiles, renameFile, newFolder } })

    await runAction('files.trash', { paths: ['a.png', 'b.png'] })
    await runAction('files.duplicate', { paths: ['a.png'] })
    await runAction('file.rename', { path: 'a.png', name: 'b.png' })
    await runAction('folder.new', { folder: 'Plans', name: 'Nuit' })

    expect(trashFiles).toHaveBeenCalledWith(['a.png', 'b.png'])
    expect(duplicateFiles).toHaveBeenCalledWith(['a.png'])
    expect(renameFile).toHaveBeenCalledWith('a.png', 'b.png')
    expect(newFolder).toHaveBeenCalledWith('Plans', 'Nuit')
  })

  it('refuses an empty list rather than calling the channel with one', async () => {
    const trashFiles = vi.fn(async () => BATCH)
    withProject({ project: { trashFiles } })

    expect(await runAction('files.trash', { paths: [] })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(trashFiles).not.toHaveBeenCalled()
  })
})

describe('opening and making a project', () => {
  /**
   * The whole reason these exist beside the `project.new` and `project.open` COMMANDS: those
   * raise a system dialog nobody outside the machine can fill, so a client calling them hangs
   * the studio on a modal. These take the path.
   */
  it('opens a project from an absolute path, with no dialog raised', async () => {
    const open = vi.fn(async () => true)
    useProject.setState({ open })

    expect(await runAction('project.open', { path: '/tmp/Autre' })).toEqual({ ok: true })
    expect(open).toHaveBeenCalledWith('/tmp/Autre')
  })

  it('reports a folder that was no project as a refusal', async () => {
    useProject.setState({ open: vi.fn(async () => false) })

    expect(await runAction('project.open', { path: '/tmp/vide' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  // Created and then opened: a project nobody is in is a folder, and every other action of this
  // family would refuse on the very thing that was just made.
  it('opens what it just created', async () => {
    const created = {
      path: '/tmp/Neuf',
      manifest: { version: 1, name: 'Neuf', createdAt: WHEN, updatedAt: WHEN },
    }
    withProject({ project: { create: vi.fn(async () => created) } })
    const open = vi.fn(async () => true)
    useProject.setState({ open })

    expect(await runAction('project.create', { path: '/tmp/Neuf' })).toEqual({
      ok: true,
      data: created,
    })
    expect(open).toHaveBeenCalledWith('/tmp/Neuf')
  })
})
