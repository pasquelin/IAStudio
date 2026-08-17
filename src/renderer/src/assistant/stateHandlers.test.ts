import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { DocumentNameFailure } from '@shared/domain/documentName'
import { installFakeBridge } from '@/services/fakeBridge'
import { installDocuments } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { runAction } from './executor'

const openDocument = vi.hoisted(() => vi.fn())
vi.mock('@/app/dockviewApi', () => ({ openDocument, showWorkspace: vi.fn() }))

const closeDocument = vi.hoisted(() => vi.fn(async () => true))
const documentIsDirty = vi.hoisted(() => vi.fn(() => false))
vi.mock('@/app/documentIo', () => ({ closeDocument, documentIsDirty }))

const WHEN = '2026-08-17T10:00:00.000Z'

const stored = (id: string, path: string): DocumentDescriptor => ({
  id,
  kind: 'scene',
  workspace: '3d',
  title: id,
  path,
})

beforeEach(() => {
  installFakeBridge()
  openDocument.mockClear()
  closeDocument.mockClear()
  closeDocument.mockResolvedValue(true)
  documentIsDirty.mockReturnValue(false)
  useProject.setState({
    project: {
      path: '/tmp/Film',
      manifest: { version: 1, name: 'Film', createdAt: WHEN, updatedAt: WHEN },
    },
  })
  useLayouts.setState({ activeWorkspace: '3d', home: false })
  useDocuments.setState({ stored: [] })
})

describe('reading what the studio is', () => {
  /**
   * The one action every other one depends on: `command.run` refuses anything whose surface is
   * not active, and before this there was no way to ask which one was. The scope is answered
   * beside the surface for exactly that reason — a refusal a client cannot act on is noise.
   */
  it('names the project, the surface it puts a command in, and which tab is in front', async () => {
    installDocuments({ 'doc-a': '3d', 'doc-b': 'image' }, 'doc-b')

    const outcome = await runAction('studio.state', {})

    expect(outcome).toMatchObject({
      ok: true,
      data: {
        project: { path: '/tmp/Film' },
        workspace: '3d',
        surface: '3d',
        commandScope: 'scene',
        authenticated: false,
      },
    })
    const state = outcome.ok
      ? (outcome.data as { documents: { id: string; active: boolean }[] })
      : null
    expect(state?.documents.find(one => one.id === 'doc-b')?.active).toBe(true)
    expect(state?.documents.find(one => one.id === 'doc-a')?.active).toBe(false)
  })

  it('says a document holds unsaved work, from the same predicate the tab bullet reads', async () => {
    installDocuments({ 'doc-a': '3d' }, 'doc-a')
    documentIsDirty.mockReturnValue(true)

    const outcome = await runAction('studio.state', {})

    expect(outcome).toMatchObject({ ok: true, data: { documents: [{ modified: true }] } })
  })

  // The folder holds documents no tab shows, and those are exactly the ones a client needs
  // listed: it cannot open what it was never told about.
  it('lists what the folder holds as well as what is open, saying which is which', async () => {
    installDocuments({ 'doc-open': '3d' }, 'doc-open')
    useDocuments.setState({ stored: [stored('doc-shut', 'Repérages/Niveau.scene')] })

    const outcome = await runAction('documents.list', {})
    const listed = outcome.ok ? (outcome.data as { id: string; open: boolean }[]) : []

    expect(listed.find(one => one.id === 'doc-shut')?.open).toBe(false)
    expect(listed.find(one => one.id === 'doc-open')?.open).toBe(true)
  })
})

describe('putting a document in front', () => {
  it('activates one that is open', async () => {
    installDocuments({ 'doc-a': '3d', 'doc-b': 'image' }, 'doc-a')

    expect(await runAction('document.activate', { documentId: 'doc-b' })).toEqual({ ok: true })
    expect(useDocuments.getState().activeId).toBe('doc-b')
  })

  it('refuses an id no tab holds rather than clearing the centre', async () => {
    installDocuments({ 'doc-a': '3d' }, 'doc-a')

    expect(await runAction('document.activate', { documentId: 'doc-z' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(useDocuments.getState().activeId).toBe('doc-a')
  })

  it('opens a document of the folder by its path', async () => {
    installDocuments({}, '')
    useDocuments.setState({ stored: [stored('doc-shut', 'Repérages/Niveau.scene')] })

    expect(await runAction('document.open', { path: 'Repérages/Niveau.scene' })).toEqual({
      ok: true,
      data: { documentId: 'doc-shut' },
    })
    expect(openDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-shut' }))
  })

  /**
   * A listing a client holds may predate a file that has since arrived — its own generation, or
   * another program's. Answering "no such document" for one sitting on the disk is the least
   * useful refusal there is, so the folder is re-read before refusing.
   */
  it('re-reads the folder before refusing a path it has not heard of', async () => {
    installDocuments({}, '')
    const relist = vi.fn(async () => {
      useDocuments.setState({ stored: [stored('doc-new', 'Sorties/Rendu.scene')] })
    })
    useDocuments.setState({ relist })

    expect(await runAction('document.open', { path: 'Sorties/Rendu.scene' })).toMatchObject({
      ok: true,
    })
    expect(relist).toHaveBeenCalled()
  })
})

describe('closing and renaming', () => {
  // The tab's own cross, question about unsaved work included: a second path that skipped it
  // would be the only way in the studio to lose work silently.
  it('closes through the same path the tab does', async () => {
    installDocuments({ 'doc-a': '3d' }, 'doc-a')

    expect(await runAction('document.close', { documentId: 'doc-a' })).toEqual({ ok: true })
    expect(closeDocument).toHaveBeenCalledWith('doc-a')
  })

  it('reports a close the person cancelled as a refusal, not as done', async () => {
    installDocuments({ 'doc-a': '3d' }, 'doc-a')
    closeDocument.mockResolvedValue(false)

    expect(await runAction('document.close', { documentId: 'doc-a' })).toEqual({
      ok: false,
      refusal: 'declined',
    })
  })

  it('renames a document, and refuses a name the store turned down', async () => {
    installDocuments({ 'doc-a': '3d' }, 'doc-a')
    const rename = vi.fn(async () => null)
    useDocuments.setState({ rename })

    expect(await runAction('document.rename', { documentId: 'doc-a', title: 'Niveau 2' })).toEqual({
      ok: true,
    })
    expect(rename).toHaveBeenCalledWith('doc-a', 'Niveau 2')

    const turnedDown: DocumentNameFailure = 'empty'
    useDocuments.setState({ rename: vi.fn(async () => turnedDown) })
    expect(await runAction('document.rename', { documentId: 'doc-a', title: '.' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })
})

describe('reading the activity', () => {
  it('passes the limit through, and asks for the default when none is given', async () => {
    const read = vi.fn(async () => [])
    installFakeBridge({ activity: { read } })

    await runAction('activity.recent', { limit: 5 })
    expect(read).toHaveBeenCalledWith({ limit: 5 })

    await runAction('activity.recent', {})
    expect(read).toHaveBeenCalledWith({})
  })
})
