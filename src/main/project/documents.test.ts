import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { DOCUMENT_VERSION } from '@shared/domain/document'
import { createDocumentFiles, orphanStagingCopies, type DocumentFiles } from './documents'

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

  describe('list', () => {
    // The project folder is what says which documents exist: a registry kept beside it would
    // follow the application instead, and open the previous project's tabs in the next one.
    it('answers with what the folder holds, kind and workspace included', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: null })
      await documents.write('doc-2', 'image', { title: 'Poster', content: null })

      expect(await documents.list()).toEqual(
        expect.arrayContaining([
          { id: 'doc-1', kind: 'scene', title: 'Level', workspace: '3d' },
          { id: 'doc-2', kind: 'image', title: 'Poster', workspace: 'image' },
        ]),
      )
    })

    it('answers empty for a project that has never saved anything', async () => {
      expect(await documents.list()).toEqual([])
    })

    it('ignores what is not a document of a kind this build knows', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: null })
      await writeFile(join(root, 'documents', 'notes.txt'), 'a note', 'utf8')
      await writeFile(join(root, 'documents', 'old.blend'), 'x', 'utf8')

      expect((await documents.list()).map(entry => entry.id)).toEqual(['doc-1'])
    })

    // One document truncated by a crash must not cost the user the listing of all the others.
    it('skips a document it cannot read and lists the rest', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: null })
      await writeFile(join(root, 'documents', 'broken.scene'), '{ not json', 'utf8')

      expect((await documents.list()).map(entry => entry.id)).toEqual(['doc-1'])
    })

    // The folder's word beats the file's, exactly as `read` has it.
    it('skips a document whose extension disagrees with what it holds', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: null })
      const written = await readFile(join(root, 'documents', 'doc-1.scene'), 'utf8')
      await writeFile(join(root, 'documents', 'doc-2.img'), written, 'utf8')

      expect((await documents.list()).map(entry => entry.id)).toEqual(['doc-1'])
    })

    // A crash between the write and the rename leaves a staging copy behind for good. Nothing
    // else ever looks at that folder, so the listing is where it gets cleaned up.
    it('sweeps a staging copy no write is holding', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: null })
      await writeFile(
        join(root, 'documents', 'doc-9.scene.3f2a1c88-9d4e-4b7a-8c15-2e6f0a7b9d31.tmp'),
        '{}',
        'utf8',
      )

      await documents.list()
      expect(await readdir(join(root, 'documents'))).toEqual(['doc-1.scene'])
    })
  })
})

describe('orphanStagingCopies', () => {
  const first = 'doc-1.scene.3f2a1c88-9d4e-4b7a-8c15-2e6f0a7b9d31.tmp'
  const second = 'doc-2.img.7c9e0b21-4a5d-4f38-9b62-1d8e3f04a5c7.tmp'

  it('picks the staging copies nobody is holding', () => {
    expect(orphanStagingCopies([first, 'doc-1.scene', second, 'notes.txt'], new Set())).toEqual([
      first,
      second,
    ])
  })

  // A save in flight in another window is not litter: swept, its rename would fail and the
  // document the user was saving would be lost with it.
  it('leaves alone a copy a write is holding', () => {
    expect(orphanStagingCopies([first, second], new Set([first]))).toEqual([second])
  })

  // The project folder is the user's own, and a `.tmp` they left in there is not ours to
  // delete: only what this module writes carries a uuid between the name and the suffix.
  it('never picks a temporary file the studio did not write', () => {
    const entries = ['render.tmp', 'notes.tmp', 'doc-1.scene', 'tmp.img', 'a.tmp.scene']

    expect(orphanStagingCopies(entries, new Set())).toEqual([])
  })
})
