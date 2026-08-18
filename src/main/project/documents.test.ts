import { mkdir, mkdtemp, readdir, readFile, rename, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { DOCUMENT_VERSION } from '@shared/domain/document'
import { orphanStagingCopies, type DocumentFiles } from './documents'
import { documentFilesAt } from './project-fixtures'

const NOW = '2026-08-07T10:00:00.000Z'

describe('createDocumentFiles', () => {
  let root = ''
  let documents: DocumentFiles

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'scenario-documents-'))
    documents = documentFilesAt(root, NOW)
  })

  it('reads back what it wrote', async () => {
    await documents.write('doc-1', 'scene', { title: 'Untitled', content: '{"nodes":[]}' })

    expect(await documents.read('doc-1', 'scene')).toEqual({
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: 'Untitled',
      updatedAt: NOW,
      id: 'doc-1',
      content: '{"nodes":[]}',
    })
  })

  // One exact-equality assertion: it proves the folder was created, the extension comes from
  // the kind, and no staging file was left behind.
  //
  // The name is the document's own. It was the id — a uuid — which is what the explorer showed
  // the user beside a tab bearing the title, two names for one document.
  it('creates the documents folder, names the file after the document, and leaves no staging file', async () => {
    await documents.write('doc-1', 'scene', { title: 'Untitled', content: '{}' })
    expect(await readdir(join(root, 'documents'))).toEqual(['Untitled.scene'])
  })

  // The envelope on the first line, the content under it: listing a project then reads a short
  // head per file instead of parsing every document in it, and the folder still reads by eye.
  it('writes the envelope on a line of its own', async () => {
    await documents.write('doc-1', 'scene', { title: 'Level', content: '{"nodes":[]}' })

    const [head, body] = (await readFile(join(root, 'documents', 'Level.scene'), 'utf8')).split(
      '\n',
    )
    expect(JSON.parse(head ?? '')).toEqual({
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: 'Level',
      updatedAt: NOW,
      id: 'doc-1',
    })
    expect(body).toBe('{"nodes":[]}')
  })

  // The proof that the content is never parsed on this side: one that could not be would fail
  // the listing otherwise, and a scene of twenty thousand nodes costs the same as this.
  it('lists a document whose content it could never parse', async () => {
    await documents.write('doc-1', 'scene', { title: 'Level', content: 'not json at all' })

    expect(await documents.list()).toEqual([
      {
        id: 'doc-1',
        kind: 'scene',
        title: 'Level',
        workspace: '3d',
        path: 'documents/Level.scene',
      },
    ])
  })

  // What the version field was for. A file written before the envelope moved onto its own line
  // holds everything in one object, content included.
  it('reads a document written by the first version of the format', async () => {
    const legacy = {
      version: 1,
      kind: 'scene',
      title: 'Older',
      updatedAt: NOW,
      content: { nodes: ['a'] },
    }
    await mkdir(join(root, 'documents'), { recursive: true })
    await writeFile(join(root, 'documents', 'doc-1.scene'), JSON.stringify(legacy), 'utf8')

    expect(await documents.read('doc-1', 'scene')).toEqual({
      version: 1,
      kind: 'scene',
      title: 'Older',
      updatedAt: NOW,
      content: '{"nodes":["a"]}',
    })
    expect((await documents.list())[0]?.title).toBe('Older')
  })

  it('stamps the envelope itself rather than trusting what it was handed', async () => {
    const draft = { title: 'Mine', content: '{}', version: 99, kind: 'image', updatedAt: 'nope' }
    await documents.write('doc-1', 'scene', draft)

    const file = await documents.read('doc-1', 'scene')
    expect(file?.version).toBe(DOCUMENT_VERSION)
    expect(file?.kind).toBe('scene')
    expect(file?.updatedAt).toBe(NOW)
  })

  // Written to first, so this exercises a missing file and not a missing folder.
  it('answers null for a document that was never saved', async () => {
    await documents.write('other', 'scene', { title: 'Other', content: '{}' })
    expect(await documents.read('never-saved', 'scene')).toBeNull()
  })

  // An editor that serializes an untouched document to nothing writes a file with no content
  // key at all, since `JSON.stringify` drops it. Reading it back must not throw.
  it('survives a document whose content serialized to nothing', async () => {
    await documents.write('empty', 'scene', { title: 'Empty', content: '' })

    const file = await documents.read('empty', 'scene')
    expect(file?.title).toBe('Empty')
    expect(file?.content).toBe('')
  })

  // Under the name a document written before version 3 wears, for the reason spelt out below on
  // the kind disagreement: a broken envelope cannot say which document it belongs to.
  it('reports a file it cannot parse rather than answering null', async () => {
    await mkdir(join(root, 'documents'), { recursive: true })
    await writeFile(join(root, 'documents', 'doc-1.scene'), '{ truncated', 'utf8')

    await expect(documents.read('doc-1', 'scene')).rejects.toThrow()
  })

  /**
   * A document copied to another extension by hand would otherwise open in the wrong editor.
   *
   * Left under the name a document written before version 3 wears — its id — because that is
   * the one an unreadable file can still be reached by: an envelope that does not parse cannot
   * say which document it is, so a title-named file whose head is broken is nameless to the id
   * that used to address it, and reads as never saved rather than as broken.
   */
  it('refuses a file whose kind disagrees with its extension', async () => {
    await documents.write('doc-1', 'texture', { title: 'Untitled', content: '{}' })
    const source = await readFile(join(root, 'documents', 'Untitled.tex'), 'utf8')
    await writeFile(join(root, 'documents', 'doc-1.scene'), source, 'utf8')

    await expect(documents.read('doc-1', 'scene')).rejects.toThrow(/texture/)
  })

  it('refuses a file written by a later build instead of flattening it', async () => {
    await mkdir(join(root, 'documents'), { recursive: true })
    const later = { version: 99, kind: 'scene', title: 'Ahead', updatedAt: NOW }
    await writeFile(join(root, 'documents', 'doc-1.scene'), `${JSON.stringify(later)}\n{}`, 'utf8')

    await expect(documents.read('doc-1', 'scene')).rejects.toThrow()
  })

  it('removes a document, and stays quiet about one that is not there', async () => {
    await documents.write('doc-1', 'scene', { title: 'Untitled', content: '{}' })
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
    // One file, and it is the one the first write named: a document already on disk keeps the
    // file it is in, so a second write cannot leave a copy under another name beside it.
    expect(await readdir(join(root, 'documents'))).toEqual(['A.scene'])
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

  /**
   * What the whole of this change is for. A document written before version 3 is named after
   * its id — a uuid — and nothing about it may move: the layout, the recent list and every open
   * tab are keyed by that id, and the studio must not rewrite a project to open it.
   */
  describe('a document written before the file carried a name', () => {
    const legacyFile = (id: string, envelope: object, content = '{}'): Promise<void> =>
      mkdir(join(root, 'documents'), { recursive: true }).then(() =>
        writeFile(
          join(root, 'documents', `${id}.scene`),
          `${JSON.stringify(envelope)}\n${content}`,
          'utf8',
        ),
      )

    const V2 = { version: 2, kind: 'scene', title: 'Niveau', updatedAt: NOW }

    it('is called what its file name says, having nothing else to say so', async () => {
      await legacyFile('6d517ff3', V2)

      expect(await documents.list()).toEqual([
        {
          id: '6d517ff3',
          kind: 'scene',
          title: 'Niveau',
          workspace: '3d',
          path: 'documents/6d517ff3.scene',
        },
      ])
    })

    it('is left where it is, and read by the id it has always had', async () => {
      await legacyFile('6d517ff3', V2, '{"nodes":[]}')

      expect((await documents.read('6d517ff3', 'scene'))?.content).toBe('{"nodes":[]}')
      expect(await readdir(join(root, 'documents'))).toEqual(['6d517ff3.scene'])
    })

    // Opening a project must not rewrite it; saving one is where the stamp goes in.
    it('is given its id in the envelope by the next save, and keeps its file', async () => {
      await legacyFile('6d517ff3', V2)
      await documents.write('6d517ff3', 'scene', { title: 'Niveau', content: '{}' })

      expect((await documents.read('6d517ff3', 'scene'))?.id).toBe('6d517ff3')
      expect(await readdir(join(root, 'documents'))).toEqual(['6d517ff3.scene'])
    })
  })

  /**
   * A document whose extension is gone — renamed to a bare word, here or in the Finder — was a
   * document the studio stopped seeing altogether: sitting in the folder, absent from every
   * list, unopenable, and unrepairable from inside the studio since the explorer only renames
   * what it recognises. With no extension there is no claim for the envelope to contradict.
   */
  it('reads a document whose extension was lost, and names it after its envelope', async () => {
    await mkdir(join(root, 'documents'), { recursive: true })
    const envelope = {
      version: 2,
      kind: 'audio',
      title: 'ElevenLabs Sound Effects 2',
      updatedAt: NOW,
    }
    await writeFile(join(root, 'documents', 'demo'), `${JSON.stringify(envelope)}\n{}`, 'utf8')

    expect(await documents.list()).toEqual([
      {
        id: 'demo',
        kind: 'audio',
        title: 'ElevenLabs Sound Effects 2',
        workspace: 'audio',
        path: 'documents/demo',
      },
    ])
  })

  // Renaming it is what puts the extension back, so the repair is one gesture from the explorer.
  it('gives the extension back to such a document when it is renamed', async () => {
    await mkdir(join(root, 'documents'), { recursive: true })
    const envelope = { version: 2, kind: 'audio', title: 'Perdu', updatedAt: NOW }
    await writeFile(join(root, 'documents', 'demo'), `${JSON.stringify(envelope)}\n{}`, 'utf8')

    await documents.rename('demo', 'audio', 'Retrouvé')

    expect(await readdir(join(root, 'documents'))).toEqual(['Retrouvé.aud'])
  })

  // A stray note the user dropped in there is not a document, and must stay a plain file.
  it('leaves a file that is not a document alone', async () => {
    await mkdir(join(root, 'documents'), { recursive: true })
    await writeFile(join(root, 'documents', 'notes'), 'a note of mine', 'utf8')

    expect(await documents.list()).toEqual([])
  })

  /**
   * What the phase opens: a document lives where the user filed it, and the listing walks the
   * project to find it. `documents/` is only where a first save lands.
   */
  describe('documents the user filed themselves', () => {
    it('finds one wherever in the project it sits', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{"nodes":[]}' })
      await mkdir(join(root, 'Acte 1', 'Ruelles'), { recursive: true })
      await rename(
        join(root, 'documents', 'Niveau.scene'),
        join(root, 'Acte 1', 'Ruelles', 'Niveau.scene'),
      )

      expect((await documents.list())[0]).toMatchObject({
        id: 'doc-1',
        path: 'Acte 1/Ruelles/Niveau.scene',
      })
      expect((await documents.read('doc-1', 'scene'))?.content).toBe('{"nodes":[]}')
    })

    // A rename that moved the file back to `documents/` would tidy the project behind the user.
    it('renames one where it sits, without moving it', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{"nodes":[]}' })
      await mkdir(join(root, 'Acte 1'), { recursive: true })
      await rename(join(root, 'documents', 'Niveau.scene'), join(root, 'Acte 1', 'Niveau.scene'))
      await documents.list()

      expect(await documents.rename('doc-1', 'scene', 'Décor')).toMatchObject({
        path: 'Acte 1/Décor.scene',
      })
      expect(await readdir(join(root, 'Acte 1'))).toEqual(['Décor.scene'])
    })

    // The disk holds both, so a check taken over the whole tree would refuse a free name.
    it('lets two folders each hold a document of the same name', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: 'first' })
      await mkdir(join(root, 'Acte 1'), { recursive: true })
      await rename(join(root, 'documents', 'Niveau.scene'), join(root, 'Acte 1', 'Niveau.scene'))
      await documents.write('doc-2', 'scene', { title: 'Autre', content: 'second' })
      await documents.list()

      await documents.rename('doc-2', 'scene', 'Niveau')

      expect(await readdir(join(root, 'documents'))).toEqual(['Niveau.scene'])
      expect(await readdir(join(root, 'Acte 1'))).toEqual(['Niveau.scene'])
    })
  })

  /**
   * The identity is the envelope's, so a file renamed in the Finder is the same document under
   * another name — which is what lets the studio rename one without it becoming a different
   * document, and what the tabs, the layout and the recent list all depend on.
   */
  it('follows a document whose file was renamed by hand', async () => {
    await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{"nodes":[]}' })
    await rename(join(root, 'documents', 'Niveau.scene'), join(root, 'documents', 'Décor.scene'))

    expect((await documents.read('doc-1', 'scene'))?.content).toBe('{"nodes":[]}')
    expect((await documents.list())[0]).toMatchObject({
      id: 'doc-1',
      path: 'documents/Décor.scene',
    })
  })

  // The studio names what it engenders, and there is nobody to ask about a collision.
  it('suffixes a fresh document rather than writing over the name it wanted', async () => {
    await documents.write('doc-1', 'scene', { title: 'Niveau', content: 'first' })
    await documents.write('doc-2', 'scene', { title: 'Niveau', content: 'second' })

    expect((await documents.read('doc-1', 'scene'))?.content).toBe('first')
    expect((await documents.read('doc-2', 'scene'))?.content).toBe('second')
    expect([...(await readdir(join(root, 'documents')))].sort()).toEqual([
      'Niveau 2.scene',
      'Niveau.scene',
    ])
  })

  /**
   * The folder is the user's, and the studio's memory of it is filled by a listing. A file that
   * landed since — copied in by hand, or left by a window that never listed — was invisible to a
   * check taken from that memory, and the first save of a fresh document wrote straight over it.
   * `filePlan` asks the folder for the same question, and now so does this.
   */
  it('suffixes around a file it was never told about', async () => {
    await mkdir(join(root, 'documents'), { recursive: true })
    await writeFile(join(root, 'documents/Niveau.scene'), 'theirs', 'utf8')

    await documents.write('doc-1', 'scene', { title: 'Niveau', content: 'mine' })

    expect(await readFile(join(root, 'documents/Niveau.scene'), 'utf8')).toBe('theirs')
    expect((await documents.read('doc-1', 'scene'))?.content).toBe('mine')
  })

  /**
   * A title is a file name now, and a file name cannot hold a separator: `Brique 1/2` would
   * land on `Brique 1 2` and the document would answer to two names again.
   */
  it('writes a title the disk cannot hold under a name it can', async () => {
    await documents.write('doc-1', 'scene', { title: 'Brique 1/2', content: '{}' })

    expect(await readdir(join(root, 'documents'))).toEqual(['Brique 1 2.scene'])
  })

  describe('a file changed outside the studio', () => {
    const LATER = new Date('2026-08-07T11:00:00.000Z')

    // Still the same document — same id, same kind — with other content. A file replaced by
    // something unreadable is no longer this document at all, and `locate` says so first.
    const OUTSIDE = `${JSON.stringify({
      version: DOCUMENT_VERSION,
      kind: 'scene',
      title: 'Level',
      updatedAt: NOW,
      id: 'doc-1',
    })}\n{"nodes":["theirs"]}`

    // `utimes` rather than a second write and a wait: the modification time is what the studio
    // compares, and setting it outright is both exact and instant.
    const changeBehindTheStudio = async (file: string): Promise<void> => {
      await writeFile(file, OUTSIDE, 'utf8')
      await utimes(file, LATER, LATER)
    }

    it('is not written over, and the write says so rather than failing', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{"nodes":[]}' })
      const file = join(root, 'documents', 'Level.scene')
      await changeBehindTheStudio(file)

      expect(await documents.write('doc-1', 'scene', { title: 'Level', content: '{}' })).toBe(
        'stale',
      )
      expect(await readFile(file, 'utf8')).toBe(OUTSIDE)
    })

    it('is written over once the caller says the user agreed', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{"nodes":[]}' })
      await changeBehindTheStudio(join(root, 'documents', 'Level.scene'))

      const written = await documents.write(
        'doc-1',
        'scene',
        { title: 'Level', content: '{"ours":true}' },
        true,
      )

      expect(written).toBe('written')
      expect((await documents.read('doc-1', 'scene'))?.content).toBe('{"ours":true}')
    })
  })

  /**
   * The gesture the whole change exists for. A document is renamed by being called something
   * else, and its file follows — the id does not move, so the tab holding it does not either.
   */
  describe('rename', () => {
    it('moves the file and rewrites the title, keeping the id', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{"nodes":[]}' })

      const renamed = await documents.rename('doc-1', 'scene', 'Décor')

      expect(renamed).toEqual({
        id: 'doc-1',
        kind: 'scene',
        title: 'Décor',
        workspace: '3d',
        path: 'documents/Décor.scene',
      })
      expect(await readdir(join(root, 'documents'))).toEqual(['Décor.scene'])
      expect(await documents.read('doc-1', 'scene')).toMatchObject({
        title: 'Décor',
        content: '{"nodes":[]}',
      })
    })

    // The one case the old code forbade outright, `openInTab` being the only guard it had.
    it('renames a document written before the file carried a name', async () => {
      await mkdir(join(root, 'documents'), { recursive: true })
      const v2 = { version: 2, kind: 'scene', title: 'Niveau', updatedAt: NOW }
      await writeFile(
        join(root, 'documents', '6d517ff3.scene'),
        `${JSON.stringify(v2)}\n{}`,
        'utf8',
      )

      await documents.rename('6d517ff3', 'scene', 'Décor')

      expect(await readdir(join(root, 'documents'))).toEqual(['Décor.scene'])
      expect((await documents.read('6d517ff3', 'scene'))?.id).toBe('6d517ff3')
    })

    /**
     * Refused rather than suffixed: this is a name the user typed, and handing them a document
     * called something they did not write is worse than saying no.
     */
    it('refuses a name the folder already holds, and touches nothing', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: 'first' })
      await documents.write('doc-2', 'scene', { title: 'Décor', content: 'second' })

      await expect(documents.rename('doc-2', 'scene', 'Niveau')).rejects.toThrow(/duplicate/)
      expect([...(await readdir(join(root, 'documents')))].sort()).toEqual([
        'Décor.scene',
        'Niveau.scene',
      ])
    })

    it('says which refusal it is, rather than calling every one a duplicate', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{}' })

      await expect(documents.rename('doc-1', 'scene', '   ')).rejects.toThrow(/empty/)
      await expect(documents.rename('doc-1', 'scene', 'Brique 1/2')).rejects.toThrow(/invalid/)
    })

    it('lets a document keep the name it already has', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{}' })

      await expect(documents.rename('doc-1', 'scene', 'Niveau')).resolves.toMatchObject({
        path: 'documents/Niveau.scene',
      })
    })

    // An image is a directory holding its manifest and its parts; renaming it moves the lot.
    it('renames a document written as a folder, parts and all', async () => {
      const pixels = Buffer.from([137, 80, 78, 71]).toString('base64')
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: '{}',
        parts: [{ name: 'layer-1.png', data: pixels }],
      })

      await documents.rename('doc-1', 'image', 'Affiche')

      expect(await readdir(join(root, 'documents'))).toEqual(['Affiche.img'])
      expect((await documents.read('doc-1', 'image'))?.parts).toEqual([
        { name: 'layer-1.png', data: pixels },
      ])
    })

    /**
     * `fs.rename` overwrites without a word on POSIX, and replaces an empty directory without
     * one either — which is what an untouched `.img` is. Asked of the disk and not of the index:
     * the index only knows what it has read, and anything at all may be sitting there.
     */
    it('refuses when something already stands where it would land, and changes nothing', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{}' })
      await mkdir(join(root, 'documents', 'Décor.scene', 'in the way'), { recursive: true })

      await expect(documents.rename('doc-1', 'scene', 'Décor')).rejects.toThrow()
      expect((await documents.read('doc-1', 'scene'))?.title).toBe('Niveau')
      expect(await readdir(join(root, 'documents', 'Décor.scene'))).toEqual(['in the way'])
    })

    /**
     * `Niveau` → `niveau` is the plainest rename there is, and on APFS and NTFS the file it
     * would land on is the one it is leaving: the disk answered « taken » and the user was told
     * their own document was in the way.
     */
    it('lets a name change only its case', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{}' })

      await expect(documents.rename('doc-1', 'scene', 'niveau')).resolves.toMatchObject({
        path: 'documents/niveau.scene',
      })
      expect(await readdir(join(root, 'documents'))).toEqual(['niveau.scene'])
    })

    /**
     * The same rename, on a file the volume stores DECOMPOSED — how `Été.scene` arrives from a
     * zip made by Archive Utility, a share, or a restore off HFS+. The name check exempts the
     * document being renamed by plain equality, so a listing left as the disk spells it would
     * refuse the user their own document: the composed name it was known by no longer matches
     * the decomposed entry beside it.
     */
    it('lets a name change its case on a file the disk spells decomposed', async () => {
      await mkdir(join(root, 'documents'), { recursive: true })
      const envelope = `${JSON.stringify({
        version: DOCUMENT_VERSION,
        kind: 'scene',
        title: 'Été',
        updatedAt: NOW,
        id: 'doc-1',
      })}\n{}`
      await writeFile(join(root, 'documents', 'Été.scene'.normalize('NFD')), envelope, 'utf8')

      await expect(documents.rename('doc-1', 'scene', 'ÉTÉ')).resolves.toMatchObject({
        title: 'ÉTÉ',
      })
    })

    /**
     * The parts are the folder's own entries, and naming them twice would let the two disagree.
     * Left in the envelope, the manifest's first line carried the base64 of every layer — past
     * `ENVELOPE_LIMIT`, so `headOf` found no newline and read the whole thing back per listing.
     */
    it('keeps the pixels out of the manifest it rewrites', async () => {
      const pixels = Buffer.from([137, 80, 78, 71]).toString('base64')
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: '{}',
        parts: [{ name: 'layer-1.png', data: pixels }],
      })

      await documents.rename('doc-1', 'image', 'Affiche')

      const manifest = await readFile(
        join(root, 'documents', 'Affiche.img', 'document.json'),
        'utf8',
      )
      expect(manifest.split('\n')[0]).not.toContain(pixels)
      expect(await readdir(join(root, 'documents', 'Affiche.img'))).toEqual([
        'document.json',
        'layer-1.png',
      ])
    })

    // A rename and a save in flight aim at two different paths, so nothing queues them but the id.
    it('does not let a write in flight land under the name just left behind', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: 'first' })

      await Promise.all([
        documents.write('doc-1', 'scene', { title: 'Niveau', content: 'x'.repeat(100_000) }),
        documents.rename('doc-1', 'scene', 'Décor'),
      ])

      expect(await readdir(join(root, 'documents'))).toEqual(['Décor.scene'])
    })
  })

  it('keeps a failed operation from blocking the file afterwards', async () => {
    await expect(documents.read('doc-1', 'scene')).resolves.toBeNull()
    await documents.write('doc-1', 'scene', { title: 'After', content: '1' })

    expect((await documents.read('doc-1', 'scene'))?.title).toBe('After')
  })

  describe('list', () => {
    // The project folder is what says which documents exist: a registry kept beside it would
    // follow the application instead, and open the previous project's tabs in the next one.
    it('answers with what the folder holds, kind and workspace included', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{}' })
      await documents.write('doc-2', 'image', { title: 'Poster', content: '{}' })

      expect(await documents.list()).toEqual(
        expect.arrayContaining([
          {
            id: 'doc-1',
            kind: 'scene',
            title: 'Level',
            workspace: '3d',
            path: 'documents/Level.scene',
          },
          {
            id: 'doc-2',
            kind: 'image',
            title: 'Poster',
            workspace: 'image',
            path: 'documents/Poster.img',
          },
        ]),
      )
    })

    it('answers empty for a project that has never saved anything', async () => {
      expect(await documents.list()).toEqual([])
    })

    it('ignores what is not a document of a kind this build knows', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{}' })
      await writeFile(join(root, 'documents', 'notes.txt'), 'a note', 'utf8')
      await writeFile(join(root, 'documents', 'old.blend'), 'x', 'utf8')

      expect((await documents.list()).map(entry => entry.id)).toEqual(['doc-1'])
    })

    // One document truncated by a crash must not cost the user the listing of all the others.
    it('skips a document it cannot read and lists the rest', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{}' })
      await writeFile(join(root, 'documents', 'broken.scene'), '{ not json', 'utf8')

      expect((await documents.list()).map(entry => entry.id)).toEqual(['doc-1'])
    })

    // The folder's word beats the file's, exactly as `read` has it.
    it('skips a document whose extension disagrees with what it holds', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{}' })
      const written = await readFile(join(root, 'documents', 'Level.scene'), 'utf8')
      await writeFile(join(root, 'documents', 'doc-2.img'), written, 'utf8')

      expect((await documents.list()).map(entry => entry.id)).toEqual(['doc-1'])
    })

    // A crash between the write and the rename leaves a staging copy behind for good. Nothing
    // else ever looks at that folder, so the listing is where it gets cleaned up.
    it('sweeps a staging copy no write is holding', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{}' })
      await writeFile(
        join(root, 'documents', 'doc-9.scene.3f2a1c88-9d4e-4b7a-8c15-2e6f0a7b9d31.tmp'),
        '{}',
        'utf8',
      )

      await documents.list()
      expect(await readdir(join(root, 'documents'))).toEqual(['Level.scene'])
    })

    /**
     * A folder document stages a FOLDER, and the walk that feeds the listing answers files and
     * documents — it never shows one, and would have descended into it and offered its manifest
     * and its layers as though they were the user's own files. Its own folder is read for it.
     */
    it('sweeps a staging copy that is a folder, and never offers what it holds', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Planche',
        content: '{"layers":[]}',
        parts: [],
      })
      const staged = join(root, 'documents', 'Planche.img.3f2a1c88-9d4e-4b7a-8c15-2e6f0a7b9d31.tmp')
      await mkdir(staged, { recursive: true })
      await writeFile(join(staged, 'document.json'), '{}', 'utf8')

      const listed = await documents.list()

      expect(listed.map(entry => entry.id)).toEqual(['doc-1'])
      expect(await readdir(join(root, 'documents'))).toEqual(['Planche.img'])
    })
  })

  /**
   * An image keeps one PNG per layer, so it is written as a folder rather than a file. What is
   * checked here is the contract the renderer depends on: the parts come back byte for byte, and
   * nothing a part is named can reach outside the folder.
   */
  describe('a document written as a folder', () => {
    const PIXELS = Buffer.from([137, 80, 78, 71]).toString('base64')

    it('reads back the manifest and every part', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: '{"layers":[]}',
        parts: [{ name: 'layer-1.png', data: PIXELS }],
      })

      const file = await documents.read('doc-1', 'image')

      expect(file?.title).toBe('Poster')
      expect(file?.content).toBe('{"layers":[]}')
      expect(file?.parts).toEqual([{ name: 'layer-1.png', data: PIXELS }])
    })

    it('lays the folder out so it reads by hand', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: '{}',
        parts: [{ name: 'layer-1.png', data: PIXELS }],
      })

      const entries = await readdir(join(root, 'documents', 'Poster.img'))
      expect([...entries].sort()).toEqual(['document.json', 'layer-1.png'])
    })

    /**
     * The defect `writeAtomic` had, and the folder path had kept: the tidy-up threw over the
     * error it was cleaning up after, and the caller heard the wrong one.
     *
     * A `documents` that is a FILE is what makes the two distinguishable — `mkdir` fails on it
     * and so does the `rm` of the staging folder it never created, both `ENOTDIR`, one naming
     * `mkdir` and the other `lstat`. Aiming at a path that simply does not exist would prove
     * nothing: `force: true` never throws there.
     */
    it('reports why the write failed, not why the tidy-up would not go away', async () => {
      await writeFile(join(root, 'documents'), 'a file where the folder goes')

      await expect(
        documents.write('doc-1', 'image', { title: 'Poster', content: '{}' }),
      ).rejects.toThrow(/mkdir/)
    })

    it('lists a folder document like any other', async () => {
      await documents.write('doc-1', 'image', { title: 'Poster', content: '{}' })

      expect(await documents.list()).toEqual([
        {
          id: 'doc-1',
          kind: 'image',
          title: 'Poster',
          workspace: 'image',
          path: 'documents/Poster.img',
        },
      ])
    })

    // The second write must leave the folder holding the second document, not both merged.
    it('replaces the whole folder rather than merging into it', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: '{}',
        parts: [
          { name: 'layer-1.png', data: PIXELS },
          { name: 'layer-2.png', data: PIXELS },
        ],
      })
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: '{}',
        parts: [{ name: 'layer-1.png', data: PIXELS }],
      })

      const entries = await readdir(join(root, 'documents', 'Poster.img'))
      expect([...entries].sort()).toEqual(['document.json', 'layer-1.png'])
    })

    it('leaves no staging copy behind', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: '{}',
        parts: [{ name: 'layer-1.png', data: PIXELS }],
      })
      await documents.write('doc-1', 'image', { title: 'Poster', content: '{}' })

      const entries = await readdir(join(root, 'documents'))
      expect(entries).toEqual(['Poster.img'])
    })

    it('takes the whole folder away on remove', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: '{}',
        parts: [{ name: 'layer-1.png', data: PIXELS }],
      })
      await documents.remove('doc-1', 'image')

      expect(await documents.list()).toEqual([])
      expect(await readdir(join(root, 'documents'))).toEqual([])
    })

    /**
     * The renderer names the parts and the main process turns those names into paths: the one
     * field of this contract that crosses a security boundary.
     */
    it('refuses a part that would write outside the folder', async () => {
      await expect(
        documents.write('doc-1', 'image', {
          title: 'Poster',
          content: '{}',
          parts: [{ name: '../escaped.png', data: PIXELS }],
        }),
      ).rejects.toThrow(/not a file name/)

      expect(await documents.list()).toEqual([])
    })

    it('reads back nothing for a folder that was never written', async () => {
      expect(await documents.read('doc-9', 'image')).toBeNull()
    })
  })

  /**
   * A montage in the open format IS the document — there is no envelope of ours in the file, so
   * every field one carries has to come from the standard's metadata or from the folder.
   */
  describe('a montage held as OpenTimelineIO', () => {
    const otio = (studio: Record<string, unknown> = {}): string =>
      JSON.stringify({
        OTIO_SCHEMA: 'Timeline.1',
        name: 'Bande',
        metadata: { scenario: studio },
        global_start_time: null,
        tracks: { OTIO_SCHEMA: 'Stack.1', children: [] },
      })

    it('lists a file another application wrote, named after its file', async () => {
      await writeFile(join(root, 'Rushes.otio'), otio(), 'utf8')

      expect(await documents.list()).toEqual([
        {
          id: 'Rushes',
          kind: 'sequence',
          title: 'Rushes',
          workspace: 'video',
          path: 'Rushes.otio',
        },
      ])
    })

    it('remembers which document one of its own is, whatever the file is called', async () => {
      await writeFile(join(root, 'Rushes.otio'), otio({ documentId: 'doc-7' }), 'utf8')

      expect((await documents.list())[0]?.id).toBe('doc-7')
    })

    it('hands the whole standard file to the editor, untouched', async () => {
      const content = otio({ documentId: 'doc-7' })
      await writeFile(join(root, 'Rushes.otio'), content, 'utf8')
      await documents.list()

      expect(await documents.read('doc-7', 'sequence')).toEqual({
        version: DOCUMENT_VERSION,
        kind: 'sequence',
        title: '',
        updatedAt: '',
        id: 'doc-7',
        content,
      })
    })

    // The defect this whole change exists to close: a save that wrote our envelope back would
    // leave a file no other application can read, and the studio would be the only reader again.
    it('writes the montage back with nothing of ours in front of it', async () => {
      const content = otio({ documentId: 'doc-7' })
      await writeFile(join(root, 'Rushes.otio'), content, 'utf8')
      await documents.list()

      expect(await documents.write('doc-7', 'sequence', { title: 'Rushes', content })).toBe(
        'written',
      )
      expect(await readFile(join(root, 'Rushes.otio'), 'utf8')).toBe(content)
    })

    // A rename that took the spelling a NEW document gets would leave the `.otio` sitting beside
    // a `.seq` holding the same cut — two files for one document, which is the whole defect.
    it('keeps the spelling it wears when it is renamed', async () => {
      await writeFile(join(root, 'Rushes.otio'), otio({ documentId: 'doc-7' }), 'utf8')
      await documents.list()

      expect((await documents.rename('doc-7', 'sequence', 'Bande son')).path).toBe('Bande son.otio')
      expect(await readdir(root)).toEqual(['Bande son.otio'])
    })

    // A tab opened on nothing is indistinguishable from a new document, and the next ⌘S would
    // write that over whatever the file really held.
    it('leaves a file that is not a timeline out of the listing', async () => {
      await writeFile(join(root, 'Notes.otio'), '{"OTIO_SCHEMA":"Clip.1"}', 'utf8')

      expect(await documents.list()).toEqual([])
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
