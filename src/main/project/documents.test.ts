import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { DOCUMENT_VERSION } from '@shared/domain/document'
import { createDocumentFiles, type DocumentFiles } from './documents'

const NOW = '2026-08-07T10:00:00.000Z'

describe('createDocumentFiles', () => {
  let root = ''
  let documents: DocumentFiles

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'scenario-documents-'))
    documents = createDocumentFiles({ projectPath: () => root, now: () => NOW })
  })

  it('reads back what it wrote', async () => {
    await documents.write('doc-1', 'scene', { title: 'Untitled', content: { nodes: [] } })

    expect(await documents.read('doc-1', 'scene')).toEqual({
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: 'Untitled',
      updatedAt: NOW,
      content: { nodes: [] },
    })
  })

  // One exact-equality assertion: it proves the folder was created, the extension comes from
  // the kind, and no staging file was left behind.
  it('creates the documents folder, names the file after the kind, and leaves no staging file', async () => {
    await documents.write('doc-1', 'scene', { title: 'Untitled', content: null })
    expect(await readdir(join(root, 'documents'))).toEqual(['doc-1.scene'])
  })

  it('stamps the envelope itself rather than trusting what it was handed', async () => {
    const draft = { title: 'Mine', content: null, version: 99, kind: 'image', updatedAt: 'nope' }
    await documents.write('doc-1', 'scene', draft)

    const file = await documents.read('doc-1', 'scene')
    expect(file?.version).toBe(DOCUMENT_VERSION)
    expect(file?.kind).toBe('scene')
    expect(file?.updatedAt).toBe(NOW)
  })

  // Written to first, so this exercises a missing file and not a missing folder.
  it('answers null for a document that was never saved', async () => {
    await documents.write('other', 'scene', { title: 'Other', content: null })
    expect(await documents.read('never-saved', 'scene')).toBeNull()
  })

  // An editor that serializes an untouched document to nothing writes a file with no content
  // key at all, since `JSON.stringify` drops it. Reading it back must not throw.
  it('survives a document whose content serialized to nothing', async () => {
    await documents.write('empty', 'scene', { title: 'Empty', content: undefined })

    const file = await documents.read('empty', 'scene')
    expect(file?.title).toBe('Empty')
    expect(file?.content).toBeUndefined()
  })

  it('reports a file it cannot parse rather than answering null', async () => {
    await documents.write('doc-1', 'scene', { title: 'Untitled', content: null })
    await writeFile(join(root, 'documents', 'doc-1.scene'), '{ truncated', 'utf8')

    await expect(documents.read('doc-1', 'scene')).rejects.toThrow()
  })

  // A document copied to another extension by hand would otherwise open in the wrong editor.
  it('refuses a file whose kind disagrees with its extension', async () => {
    await documents.write('doc-1', 'image', { title: 'Untitled', content: null })
    const source = await readFile(join(root, 'documents', 'doc-1.img'), 'utf8')
    await writeFile(join(root, 'documents', 'doc-1.scene'), source, 'utf8')

    await expect(documents.read('doc-1', 'scene')).rejects.toThrow(/image/)
  })

  it('refuses a file written by a later build instead of flattening it', async () => {
    const file = join(root, 'documents', 'doc-1.scene')
    await documents.write('doc-1', 'scene', { title: 'Untitled', content: null })

    const stored = await readFile(file, 'utf8')
    await writeFile(file, stored.replace(`"version":${DOCUMENT_VERSION}`, '"version":99'), 'utf8')

    await expect(documents.read('doc-1', 'scene')).rejects.toThrow()
  })

  it('removes a document, and stays quiet about one that is not there', async () => {
    await documents.write('doc-1', 'scene', { title: 'Untitled', content: null })
    await documents.remove('doc-1', 'scene')

    expect(await documents.read('doc-1', 'scene')).toBeNull()
    await expect(documents.remove('doc-1', 'scene')).resolves.toBeUndefined()
  })

  it('keeps two kinds of the same id apart', async () => {
    await documents.write('twin', 'scene', { title: 'Twin', content: 'scene side' })
    await documents.write('twin', 'image', { title: 'Twin', content: 'image side' })

    expect((await documents.read('twin', 'scene'))?.content).toBe('scene side')
    expect((await documents.read('twin', 'image'))?.content).toBe('image side')
  })

  // Two windows on one document is a case the studio already lives with; a shared staging name
  // would have each overwrite the other's and rename half of one over the target.
  it('survives concurrent writes of the same document', async () => {
    await Promise.all([
      documents.write('doc-1', 'scene', { title: 'A', content: 'a'.repeat(20_000) }),
      documents.write('doc-1', 'scene', { title: 'B', content: 'b'.repeat(20_000) }),
    ])

    const file = await documents.read('doc-1', 'scene')
    expect(file?.content).toMatch(/^(a+|b+)$/)
    expect(await readdir(join(root, 'documents'))).toEqual(['doc-1.scene'])
  })

  // An autosave still staging its copy would otherwise rename it back over a document the
  // user has just deleted, and the deletion would undo itself.
  it('does not let a write in flight resurrect a removed document', async () => {
    const writing = documents.write('doc-1', 'scene', {
      title: 'Big',
      content: 'x'.repeat(200_000),
    })
    const removing = documents.remove('doc-1', 'scene')
    await Promise.all([writing, removing])

    expect(await documents.read('doc-1', 'scene')).toBeNull()
    expect(await readdir(join(root, 'documents'))).toEqual([])
  })

  it('keeps a failed operation from blocking the file afterwards', async () => {
    await expect(documents.read('doc-1', 'scene')).resolves.toBeNull()
    await documents.write('doc-1', 'scene', { title: 'After', content: 1 })

    expect((await documents.read('doc-1', 'scene'))?.title).toBe('After')
  })
})
