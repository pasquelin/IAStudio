import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { DOCUMENT_VERSION, type DocumentDescriptor } from '@shared/domain/document'
import type { OraSurface } from '@shared/domain/openRaster'
import { exists } from '@main/persistence'
import { orphanStagingCopies, type DocumentFiles } from './documents'
import { documentFilesAt } from './project-fixtures'

const NOW = '2026-08-07T10:00:00.000Z'

/**
 * Whether this volume hands back a file stored DECOMPOSED when asked for its composed name —
 * measured here rather than read off the platform, which answers for neither the filesystem nor
 * the volume a project sits on. APFS does, ext4 does not; NTFS folds CASE and not normalisation.
 */
const volumeAnswersComposedNames = async (folder: string): Promise<boolean> => {
  const probe = join(folder, 'probe-é.txt'.normalize('NFD'))
  await writeFile(probe, '', 'utf8')
  const answers = await exists(join(folder, 'probe-é.txt'.normalize('NFC')))
  await rm(probe, { force: true })
  return answers
}

/** One transparent pixel, which is all any of this needs to be real PNG bytes. */
const PIXELS = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
)

/**
 * What an image document's `content` is: the OpenRaster stack, as JSON. Anything else is refused
 * by the writer, exactly as a montage that is not a timeline is.
 */
const oraContent = (srcs: readonly string[] = [], studio = '{"layers":[]}'): string =>
  JSON.stringify({
    width: 64,
    height: 32,
    nodes: srcs.map(src => ({
      kind: 'layer',
      name: src,
      src,
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      composite: 'svg:src-over',
    })),
    studio,
  })

/** The surfaces beside it: the flatten the spec demands, and one per layer. */
const oraParts = (srcs: readonly string[] = []): OraSurface[] => [
  { path: 'mergedimage.png', png: PIXELS },
  ...srcs.map(path => ({ path, png: PIXELS })),
]

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
    expect(await readdir(join(root, 'documents'))).toEqual(['Untitled.gltf'])
  })

  // The envelope on the first line, the content under it: listing a project then reads a short
  // head per file instead of parsing every document in it, and the folder still reads by eye.
  it('writes the envelope on a line of its own', async () => {
    await documents.write('doc-1', 'scene', { title: 'Level', content: '{"nodes":[]}' })

    const [head, body] = (await readFile(join(root, 'documents', 'Level.gltf'), 'utf8')).split('\n')
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
        path: 'documents/Level.gltf',
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
    await writeFile(join(root, 'documents', 'doc-1.gltf'), JSON.stringify(legacy), 'utf8')

    expect(await documents.read('doc-1', 'scene')).toEqual({
      version: 1,
      kind: 'scene',
      title: 'Older',
      updatedAt: NOW,
      content: '{"nodes":["a"]}',
    })
    expect((await documents.list())[0]?.title).toBe('Older')
  })

  /**
   * A version 1 file is one object, content included, so there is no line to read short — it is
   * read WHOLE, and its size is no reason to refuse it. Refusing on size is what a first attempt
   * at keeping a foreign glTF out of the listing did, and it made every large legacy document
   * vanish: present in the folder, absent from every list, unopenable.
   */
  it('lists a document of the first version however far past a head it runs', async () => {
    const legacy = {
      version: 1,
      kind: 'scene',
      title: 'Older',
      updatedAt: NOW,
      content: { nodes: Array.from({ length: 4_000 }, (_, n) => `node-${n}`) },
    }
    await mkdir(join(root, 'documents'), { recursive: true })
    await writeFile(join(root, 'documents', 'doc-1.gltf'), JSON.stringify(legacy), 'utf8')

    expect((await documents.list())[0]).toMatchObject({ id: 'doc-1', kind: 'scene' })
  })

  /**
   * The other half of the same rule: a file that opens like nothing of ours is turned away rather
   * than read whole at every listing. A glTF the user exported into the project is minified onto
   * one line, textures and buffers in base64 — reading it whole on the thread that owns every
   * window is a freeze per listing, not a slow listing.
   */
  it('turns away a file of an open format the studio did not write', async () => {
    await mkdir(join(root, 'documents'), { recursive: true })
    const gltf = { asset: { version: '2.0' }, scenes: [{ nodes: [0] }], padding: 'x'.repeat(9_000) }
    await writeFile(join(root, 'documents', 'Décor.gltf'), JSON.stringify(gltf), 'utf8')

    expect(await documents.list()).toEqual([])
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
    await writeFile(join(root, 'documents', 'doc-1.gltf'), '{ truncated', 'utf8')

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
    const source = await readFile(join(root, 'documents', 'Untitled.mtlx'), 'utf8')
    await writeFile(join(root, 'documents', 'doc-1.gltf'), source, 'utf8')

    await expect(documents.read('doc-1', 'scene')).rejects.toThrow(/texture/)
  })

  /**
   * Two kinds wear `.gltf`, so the FILE says which — but only within what the extension could
   * name. Trusting the head outright would open a material in the scene editor, and the listing
   * is where that starts: a descriptor is built before anything asks `read` for a kind.
   */
  it('lets the file pick between the kinds its extension names, and no further', async () => {
    await mkdir(join(root, 'documents'), { recursive: true })
    const head = (kind: string): string =>
      `${JSON.stringify({ version: DOCUMENT_VERSION, kind, title: kind, updatedAt: NOW })}\n{}`
    await writeFile(join(root, 'documents', 'Dusk.gltf'), head('skybox'), 'utf8')
    await writeFile(join(root, 'documents', 'Rock.gltf'), head('texture'), 'utf8')

    expect((await documents.list()).map(one => one.kind)).toEqual(['skybox'])
  })

  it('refuses a file written by a later build instead of flattening it', async () => {
    await mkdir(join(root, 'documents'), { recursive: true })
    const later = { version: 99, kind: 'scene', title: 'Ahead', updatedAt: NOW }
    await writeFile(join(root, 'documents', 'doc-1.gltf'), `${JSON.stringify(later)}\n{}`, 'utf8')

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
    await documents.write('twin', 'image', {
      title: 'Twin',
      content: oraContent(),
      parts: oraParts(),
    })

    expect((await documents.read('twin', 'scene'))?.content).toBe('scene side')
    expect(JSON.parse((await documents.read('twin', 'image'))?.content ?? '')).toMatchObject({
      studio: '{"layers":[]}',
    })
  })

  /**
   * The five gestures a format is not delivered without: write it, read it back, list it, rename
   * it, and open it again. A sky IS its glTF, so all five run against a real one here — the file
   * another application reads, not a spelling of the studio's own under the same extension.
   */
  it('writes a sky as glTF, and finds it again by its own head', async () => {
    const sky = JSON.stringify({
      asset: { version: '2.0', generator: 'IA Studio' },
      scene: 0,
      scenes: [{ name: 'Crépuscule', nodes: [0] }],
      nodes: [{ name: 'Sun', rotation: [0, 0, 0, 1] }],
      extras: { scenario: { sun: { intensity: 2 } } },
    })
    await documents.write('doc-sky', 'skybox', { title: 'Crépuscule', content: sky })

    const listed = await documents.list()
    expect(listed).toMatchObject([{ id: 'doc-sky', kind: 'skybox', title: 'Crépuscule' }])

    // Whole, and still glTF: the envelope went into `asset.extras` rather than in front of it.
    const onDisk: unknown = JSON.parse(
      await readFile(join(root, 'documents', 'Crépuscule.gltf'), 'utf8'),
    )
    expect(onDisk).toMatchObject({ asset: { version: '2.0' }, scene: 0 })

    await documents.rename('doc-sky', 'skybox', 'Aube')
    expect((await documents.read('doc-sky', 'skybox'))?.content).toContain('"scenario"')
    expect(await readdir(join(root, 'documents'))).toEqual(['Aube.gltf'])
  })

  /**
   * The same five for the material. The one that caught the sky's defect is the RENAME: it
   * rewrites the body from what a read answered, so anything a read drops is written back empty.
   */
  it('writes a material as MaterialX, and finds it again by its own head', async () => {
    const material = JSON.stringify({
      images: [
        {
          input: 'base_color',
          type: 'color3',
          file: 'Assets/base.png',
          colorspace: 'srgb_texture',
          tiling: [1, 1],
          offset: [0, 0],
        },
      ],
      values: [{ input: 'specular_roughness', type: 'float', value: 0.5 }],
      studio: { material: { edgeIntensity: 0.4 } },
    })
    await documents.write('doc-mat', 'texture', { title: 'Laiton', content: material })

    const listed = await documents.list()
    expect(listed).toMatchObject([{ id: 'doc-mat', kind: 'texture', title: 'Laiton' }])

    // Real MaterialX, not a spelling of the studio's own wearing the extension.
    const onDisk = await readFile(join(root, 'documents', 'Laiton.mtlx'), 'utf8')
    expect(onDisk.startsWith('<?xml version="1.0"?>\n<materialx version="1.39"')).toBe(true)
    expect(onDisk).toContain('<standard_surface name="SR_scenario" type="surfaceshader">')

    await documents.rename('doc-mat', 'texture', 'Bronze')
    expect(await readdir(join(root, 'documents'))).toEqual(['Bronze.mtlx'])
    // The dial no MaterialX input can carry survived the rewrite the rename does.
    expect((await documents.read('doc-mat', 'texture'))?.content).toContain('edgeIntensity')
    expect(await documents.list()).toMatchObject([{ id: 'doc-mat', title: 'Bronze' }])
  })

  /**
   * `.gltf` names two kinds, so the address a document of either WOULD have had is the same one
   * — and closing a sky that was never saved would have deleted the scene sitting at it. Removal
   * asks the file whose it is rather than trusting where it was pointed.
   */
  it('removes nothing when the file at that address belongs to the other kind', async () => {
    await documents.write('twin', 'scene', { title: 'Twin', content: '{}' })
    await rename(join(root, 'documents', 'Twin.gltf'), join(root, 'documents', 'twin.gltf'))

    await documents.remove('twin', 'skybox')

    expect(await readdir(join(root, 'documents'))).toEqual(['twin.gltf'])
  })

  /**
   * Written down rather than hidden, and it is `locate` that decides it: a document whose
   * envelope stopped reading cannot be FOUND — `holds` refuses the cached path and the walk no
   * longer lists it — so removal reaches the address it would have had, and the real file stays.
   * Invisible in every list and undeletable from the studio; the Finder is the way out.
   */
  it('leaves behind a document whose envelope stopped reading, having nowhere to look', async () => {
    await documents.write('doc-1', 'scene', { title: 'Level', content: '{}' })
    await writeFile(join(root, 'documents', 'Level.gltf'), '{ truncated', 'utf8')

    await documents.remove('doc-1', 'scene')

    expect(await readdir(join(root, 'documents'))).toEqual(['Level.gltf'])
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
    expect(await readdir(join(root, 'documents'))).toEqual(['A.gltf'])
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
          join(root, 'documents', `${id}.gltf`),
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
          path: 'documents/6d517ff3.gltf',
        },
      ])
    })

    it('is left where it is, and read by the id it has always had', async () => {
      await legacyFile('6d517ff3', V2, '{"nodes":[]}')

      expect((await documents.read('6d517ff3', 'scene'))?.content).toBe('{"nodes":[]}')
      expect(await readdir(join(root, 'documents'))).toEqual(['6d517ff3.gltf'])
    })

    // Opening a project must not rewrite it; saving one is where the stamp goes in.
    it('is given its id in the envelope by the next save, and keeps its file', async () => {
      await legacyFile('6d517ff3', V2)
      await documents.write('6d517ff3', 'scene', { title: 'Niveau', content: '{}' })

      expect((await documents.read('6d517ff3', 'scene'))?.id).toBe('6d517ff3')
      expect(await readdir(join(root, 'documents'))).toEqual(['6d517ff3.gltf'])
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

  /**
   * Renaming it is what puts the extension back, so the repair is one gesture from the explorer.
   *
   * Listed again rather than merely counted on disk: the extension it GAINS decides how the
   * bytes are spelt, and writing them the way the file it is LEAVING was spelt made a rename
   * destroy the document — right name, unreadable body, gone from every list at the next walk.
   */
  it('gives the extension back to such a document when it is renamed', async () => {
    await mkdir(join(root, 'documents'), { recursive: true })
    const envelope = { version: 2, kind: 'texture', title: 'Perdu', updatedAt: NOW }
    await writeFile(join(root, 'documents', 'demo'), `${JSON.stringify(envelope)}\n{}`, 'utf8')

    await documents.rename('demo', 'texture', 'Retrouvé')

    expect(await readdir(join(root, 'documents'))).toEqual(['Retrouvé.mtlx'])
    expect((await documents.list()).map(one => one.title)).toEqual(['Retrouvé'])
  })

  /**
   * A montage IS its OpenTimelineIO file, so a body that is not one cannot be written into that
   * name. Refused LOUDLY and before anything moves: the file the user has is left exactly as it
   * was, where a rename that went through would have left a document nothing can read again.
   */
  it('refuses to rename a document into a spelling its body cannot be written in', async () => {
    await mkdir(join(root, 'documents'), { recursive: true })
    const envelope = { version: 2, kind: 'audio', title: 'Perdu', updatedAt: NOW }
    await writeFile(join(root, 'documents', 'demo'), `${JSON.stringify(envelope)}\n{}`, 'utf8')

    await expect(documents.rename('demo', 'audio', 'Retrouvé')).rejects.toThrow()
    expect(await readdir(join(root, 'documents'))).toEqual(['demo'])
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
        join(root, 'documents', 'Niveau.gltf'),
        join(root, 'Acte 1', 'Ruelles', 'Niveau.gltf'),
      )

      expect((await documents.list())[0]).toMatchObject({
        id: 'doc-1',
        path: 'Acte 1/Ruelles/Niveau.gltf',
      })
      expect((await documents.read('doc-1', 'scene'))?.content).toBe('{"nodes":[]}')
    })

    // A rename that moved the file back to `documents/` would tidy the project behind the user.
    it('renames one where it sits, without moving it', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{"nodes":[]}' })
      await mkdir(join(root, 'Acte 1'), { recursive: true })
      await rename(join(root, 'documents', 'Niveau.gltf'), join(root, 'Acte 1', 'Niveau.gltf'))
      await documents.list()

      expect(await documents.rename('doc-1', 'scene', 'Décor')).toMatchObject({
        path: 'Acte 1/Décor.gltf',
      })
      expect(await readdir(join(root, 'Acte 1'))).toEqual(['Décor.gltf'])
    })

    // The disk holds both, so a check taken over the whole tree would refuse a free name.
    it('lets two folders each hold a document of the same name', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: 'first' })
      await mkdir(join(root, 'Acte 1'), { recursive: true })
      await rename(join(root, 'documents', 'Niveau.gltf'), join(root, 'Acte 1', 'Niveau.gltf'))
      await documents.write('doc-2', 'scene', { title: 'Autre', content: 'second' })
      await documents.list()

      await documents.rename('doc-2', 'scene', 'Niveau')

      expect(await readdir(join(root, 'documents'))).toEqual(['Niveau.gltf'])
      expect(await readdir(join(root, 'Acte 1'))).toEqual(['Niveau.gltf'])
    })
  })

  /**
   * The identity is the envelope's, so a file renamed in the Finder is the same document under
   * another name — which is what lets the studio rename one without it becoming a different
   * document, and what the tabs, the layout and the recent list all depend on.
   */
  it('follows a document whose file was renamed by hand', async () => {
    await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{"nodes":[]}' })
    await rename(join(root, 'documents', 'Niveau.gltf'), join(root, 'documents', 'Décor.gltf'))

    expect((await documents.read('doc-1', 'scene'))?.content).toBe('{"nodes":[]}')
    expect((await documents.list())[0]).toMatchObject({
      id: 'doc-1',
      path: 'documents/Décor.gltf',
    })
  })

  // The studio names what it engenders, and there is nobody to ask about a collision.
  it('suffixes a fresh document rather than writing over the name it wanted', async () => {
    await documents.write('doc-1', 'scene', { title: 'Niveau', content: 'first' })
    await documents.write('doc-2', 'scene', { title: 'Niveau', content: 'second' })

    expect((await documents.read('doc-1', 'scene'))?.content).toBe('first')
    expect((await documents.read('doc-2', 'scene'))?.content).toBe('second')
    expect([...(await readdir(join(root, 'documents')))].sort()).toEqual([
      'Niveau 2.gltf',
      'Niveau.gltf',
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
    await writeFile(join(root, 'documents/Niveau.gltf'), 'theirs', 'utf8')

    await documents.write('doc-1', 'scene', { title: 'Niveau', content: 'mine' })

    expect(await readFile(join(root, 'documents/Niveau.gltf'), 'utf8')).toBe('theirs')
    expect((await documents.read('doc-1', 'scene'))?.content).toBe('mine')
  })

  /**
   * A title is a file name now, and a file name cannot hold a separator: `Brique 1/2` would
   * land on `Brique 1 2` and the document would answer to two names again.
   */
  it('writes a title the disk cannot hold under a name it can', async () => {
    await documents.write('doc-1', 'scene', { title: 'Brique 1/2', content: '{}' })

    expect(await readdir(join(root, 'documents'))).toEqual(['Brique 1 2.gltf'])
  })

  /**
   * A document duplicated in the Finder carries the id of the one it was copied from. The listing
   * keeps that id for the first in path order and calls the second after its own PATH, which is
   * unique by construction — the alternative being a file plainly sitting in the folder and
   * absent from every list.
   *
   * What that leaves is a document whose id is a path: every gesture of the studio then arrives
   * with that id, and the file's own envelope still answers the OLD one.
   */
  describe('a document duplicated outside the studio', () => {
    /**
     * The one the listing did NOT give the envelope's id to — whichever of the pair that is.
     *
     * Which one wins is settled by path order and is nobody's business: `Level copie.gltf` sorts
     * before `Level.gltf`, a space being under a dot. What matters is the loser, and that it is
     * reachable at all.
     */
    const secondOfTwo = async (): Promise<DocumentDescriptor> => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{"nodes":["mine"]}' })
      await copyFile(
        join(root, 'documents', 'Level.gltf'),
        join(root, 'documents', 'Level copie.gltf'),
      )

      const second = (await documents.list()).find(one => one.id !== 'doc-1')
      if (!second) throw new Error('expected the pair to be told apart')
      return second
    }

    it('tells the pair apart, calling one of them after its own path', async () => {
      const second = await secondOfTwo()

      expect(second.id).toBe(second.path)
      expect((await documents.list()).map(one => one.id).sort()).toEqual(
        ['doc-1', second.path].sort(),
      )
    })

    // Listed and unopenable is the worst of both: the row is there, the double-click gives an
    // empty tab, and the next ⌘S writes that emptiness under `documents/<the whole path>.gltf`.
    it('reads it back rather than answering nothing', async () => {
      const second = await secondOfTwo()

      expect((await documents.read(second.id, 'scene'))?.content).toBe('{"nodes":["mine"]}')
    })

    it('writes it back into its own file', async () => {
      const second = await secondOfTwo()

      expect(await documents.write(second.id, 'scene', { title: 'x', content: 'theirs' })).toBe(
        'written',
      )
      expect(await readFile(join(root, second.path), 'utf8')).toContain('theirs')
    })

    it('removes it rather than the other one', async () => {
      const second = await secondOfTwo()

      await documents.remove(second.id, 'scene')

      expect(await readdir(join(root, 'documents'))).toEqual([
        basename(second.path) === 'Level.gltf' ? 'Level copie.gltf' : 'Level.gltf',
      ])
    })
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
      const file = join(root, 'documents', 'Level.gltf')
      await changeBehindTheStudio(file)

      expect(await documents.write('doc-1', 'scene', { title: 'Level', content: '{}' })).toBe(
        'stale',
      )
      expect(await readFile(file, 'utf8')).toBe(OUTSIDE)
    })

    /**
     * `headOf` keeps what it read, keyed on the modification time and the size — a scene is a
     * whole parse to open the head of, and `locate` asks for one at every save. A file the user
     * replaced in the Finder must not be answered for out of that map.
     */
    it('is listed as what it now holds, never as what the studio last read', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{"nodes":[]}' })
      expect((await documents.list()).map(entry => entry.kind)).toEqual(['scene'])

      const file = join(root, 'documents', 'Level.gltf')
      await writeFile(
        file,
        `${JSON.stringify({ version: DOCUMENT_VERSION, kind: 'skybox', title: 'Level', updatedAt: NOW, id: 'doc-1' })}\n{}`,
        'utf8',
      )
      await utimes(file, LATER, LATER)

      expect((await documents.list()).map(entry => entry.kind)).toEqual(['skybox'])
    })

    it('is written over once the caller says the user agreed', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{"nodes":[]}' })
      await changeBehindTheStudio(join(root, 'documents', 'Level.gltf'))

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
        path: 'documents/Décor.gltf',
      })
      expect(await readdir(join(root, 'documents'))).toEqual(['Décor.gltf'])
      expect(await documents.read('doc-1', 'scene')).toMatchObject({
        title: 'Décor',
        content: '{"nodes":[]}',
      })
    })

    // The one case the old code forbade outright, `openInTab` being the only guard it had.
    it('renames a document written before the file carried a name', async () => {
      await mkdir(join(root, 'documents'), { recursive: true })
      const v2 = { version: 2, kind: 'scene', title: 'Niveau', updatedAt: NOW }
      await writeFile(join(root, 'documents', '6d517ff3.gltf'), `${JSON.stringify(v2)}\n{}`, 'utf8')

      await documents.rename('6d517ff3', 'scene', 'Décor')

      expect(await readdir(join(root, 'documents'))).toEqual(['Décor.gltf'])
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
        'Décor.gltf',
        'Niveau.gltf',
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
        path: 'documents/Niveau.gltf',
      })
    })

    /**
     * The container is rewritten from the document, so a rename that dropped its surfaces would
     * write a stack with no pixels under it — every layer gone, on a rename, in silence. That is
     * what the old folder shape hid: the parts were the folder's own entries and stayed put.
     */
    it('renames a container, surfaces and all', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: oraContent(['data/p_a.png']),
        parts: oraParts(['data/p_a.png']),
      })

      await documents.rename('doc-1', 'image', 'Affiche')

      expect(await readdir(join(root, 'documents'))).toEqual(['Affiche.ora'])
      expect((await documents.read('doc-1', 'image'))?.parts).toEqual(oraParts(['data/p_a.png']))
    })

    /**
     * `fs.rename` overwrites without a word on POSIX, and replaces an empty directory without
     * one either — which is what an untouched `.ora` is. Asked of the disk and not of the index:
     * the index only knows what it has read, and anything at all may be sitting there.
     */
    it('refuses when something already stands where it would land, and changes nothing', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{}' })
      await mkdir(join(root, 'documents', 'Décor.gltf', 'in the way'), { recursive: true })

      await expect(documents.rename('doc-1', 'scene', 'Décor')).rejects.toThrow()
      expect((await documents.read('doc-1', 'scene'))?.title).toBe('Niveau')
      expect(await readdir(join(root, 'documents', 'Décor.gltf'))).toEqual(['in the way'])
    })

    /**
     * `Niveau` → `niveau` is the plainest rename there is, and on APFS and NTFS the file it
     * would land on is the one it is leaving: the disk answered « taken » and the user was told
     * their own document was in the way.
     */
    it('lets a name change only its case', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: '{}' })

      await expect(documents.rename('doc-1', 'scene', 'niveau')).resolves.toMatchObject({
        path: 'documents/niveau.gltf',
      })
      expect(await readdir(join(root, 'documents'))).toEqual(['niveau.gltf'])
    })

    /**
     * The same rename, on a file the volume stores DECOMPOSED — how `Été.gltf` arrives from a
     * zip made by Archive Utility, a share, or a restore off HFS+. The name check exempts the
     * document being renamed by plain equality, so a listing left as the disk spells it would
     * refuse the user their own document: the composed name it was known by no longer matches
     * the decomposed entry beside it.
     *
     * The blind spot, in clear, and it is a defect rather than an omission: `FolderEntry.path`
     * is both the identity a catalogue joins on — rightly NFC — and the address every `join(root,
     * path)` opens. Where the volume does not answer a composed name, ext4 among them, the second
     * job has no translation back and the document is listed but unreachable.
     */
    it('lets a name change its case on a file the disk spells decomposed', async ({ skip }) => {
      await mkdir(join(root, 'documents'), { recursive: true })
      if (!(await volumeAnswersComposedNames(join(root, 'documents')))) return skip()

      const envelope = `${JSON.stringify({
        version: DOCUMENT_VERSION,
        kind: 'scene',
        title: 'Été',
        updatedAt: NOW,
        id: 'doc-1',
      })}\n{}`
      await writeFile(join(root, 'documents', 'Été.gltf'.normalize('NFD')), envelope, 'utf8')

      await expect(documents.rename('doc-1', 'scene', 'ÉTÉ')).resolves.toMatchObject({
        title: 'ÉTÉ',
      })
    })

    // A rename and a save in flight aim at two different paths, so nothing queues them but the id.
    it('does not let a write in flight land under the name just left behind', async () => {
      await documents.write('doc-1', 'scene', { title: 'Niveau', content: 'first' })

      await Promise.all([
        documents.write('doc-1', 'scene', { title: 'Niveau', content: 'x'.repeat(100_000) }),
        documents.rename('doc-1', 'scene', 'Décor'),
      ])

      expect(await readdir(join(root, 'documents'))).toEqual(['Décor.gltf'])
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
      await documents.write('doc-2', 'image', {
        title: 'Poster',
        content: oraContent(),
        parts: oraParts(),
      })

      expect(await documents.list()).toEqual(
        expect.arrayContaining([
          {
            id: 'doc-1',
            kind: 'scene',
            title: 'Level',
            workspace: '3d',
            path: 'documents/Level.gltf',
          },
          {
            id: 'doc-2',
            kind: 'image',
            title: 'Poster',
            workspace: 'image',
            path: 'documents/Poster.ora',
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
      await writeFile(join(root, 'documents', 'broken.gltf'), '{ not json', 'utf8')

      expect((await documents.list()).map(entry => entry.id)).toEqual(['doc-1'])
    })

    // The folder's word beats the file's, exactly as `read` has it.
    it('skips a document whose extension disagrees with what it holds', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{}' })
      const written = await readFile(join(root, 'documents', 'Level.gltf'), 'utf8')
      await writeFile(join(root, 'documents', 'doc-2.ora'), written, 'utf8')

      expect((await documents.list()).map(entry => entry.id)).toEqual(['doc-1'])
    })

    // A crash between the write and the rename leaves a staging copy behind for good. Nothing
    // else ever looks at that folder, so the listing is where it gets cleaned up.
    it('sweeps a staging copy no write is holding', async () => {
      await documents.write('doc-1', 'scene', { title: 'Level', content: '{}' })
      await writeFile(
        join(root, 'documents', 'doc-9.gltf.3f2a1c88-9d4e-4b7a-8c15-2e6f0a7b9d31.tmp'),
        '{}',
        'utf8',
      )

      await documents.list()
      expect(await readdir(join(root, 'documents'))).toEqual(['Level.gltf'])
    })

    /**
     * The remains of a container half-written by a process that died. A file now, where it used
     * to be a folder — and the walk still has to leave it out of the listing and sweep it away.
     */
    it('sweeps a staging copy of a container', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Planche',
        content: oraContent(),
        parts: oraParts(),
      })
      await writeFile(
        join(root, 'documents', 'Planche.ora.3f2a1c88-9d4e-4b7a-8c15-2e6f0a7b9d31.tmp'),
        'half a container',
        'utf8',
      )

      const listed = await documents.list()

      expect(listed.map(entry => entry.id)).toEqual(['doc-1'])
      expect(await readdir(join(root, 'documents'))).toEqual(['Planche.ora'])
    })
  })

  /**
   * An image document IS an OpenRaster container — one file, a ZIP, holding a `stack.xml`, one
   * PNG per surface and the studio's own state. What is checked here is the contract the
   * renderer depends on: the surfaces come back byte for byte, and the file another application
   * opens is the document rather than a copy of it.
   */
  describe('a document written as an OpenRaster container', () => {
    it('reads back the stack and every surface', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: oraContent(['data/p_a.png']),
        parts: oraParts(['data/p_a.png']),
      })

      const file = await documents.read('doc-1', 'image')

      expect(file?.title).toBe('Poster')
      expect(JSON.parse(file?.content ?? '')).toMatchObject({
        width: 64,
        height: 32,
        studio: '{"layers":[]}',
      })
      expect(file?.parts).toEqual(oraParts(['data/p_a.png']))
    })

    /** One FILE, not a folder — and a ZIP another application opens, `mimetype` first. */
    it('writes one file, and it is a container', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: oraContent(['data/p_a.png']),
        parts: oraParts(['data/p_a.png']),
      })

      expect(await readdir(join(root, 'documents'))).toEqual(['Poster.ora'])
      const bytes = await readFile(join(root, 'documents', 'Poster.ora'))
      expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b])
      expect(bytes.subarray(30, 38).toString('utf8')).toBe('mimetype')
    })

    /**
     * The defect `writeAtomic` had: the tidy-up threw over the error it was cleaning up after,
     * and the caller heard the wrong one. A `documents` that is a FILE is what makes them
     * distinguishable — `mkdir` fails on it, naming itself.
     */
    it('reports why the write failed, not why the tidy-up would not go away', async () => {
      await writeFile(join(root, 'documents'), 'a file where the folder goes')

      await expect(
        documents.write('doc-1', 'image', { title: 'Poster', content: oraContent() }),
      ).rejects.toThrow(/mkdir/)
    })

    it('lists a container like any other document', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: oraContent(),
        parts: oraParts(),
      })

      expect(await documents.list()).toEqual([
        {
          id: 'doc-1',
          kind: 'image',
          title: 'Poster',
          workspace: 'image',
          path: 'documents/Poster.ora',
        },
      ])
    })

    // Written whole at every ⌘S: the second write must leave the container holding the second
    // document, not both merged.
    it('replaces the whole container rather than merging into it', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: oraContent(['data/p_a.png', 'data/p_b.png']),
        parts: oraParts(['data/p_a.png', 'data/p_b.png']),
      })
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: oraContent(['data/p_a.png']),
        parts: oraParts(['data/p_a.png']),
      })

      expect((await documents.read('doc-1', 'image'))?.parts).toEqual(oraParts(['data/p_a.png']))
    })

    it('leaves no staging copy behind', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: oraContent(['data/p_a.png']),
        parts: oraParts(['data/p_a.png']),
      })
      await documents.write('doc-1', 'image', { title: 'Poster', content: oraContent() })

      expect(await readdir(join(root, 'documents'))).toEqual(['Poster.ora'])
    })

    it('takes the container away on remove', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: oraContent(['data/p_a.png']),
        parts: oraParts(['data/p_a.png']),
      })
      await documents.remove('doc-1', 'image')

      expect(await documents.list()).toEqual([])
      expect(await readdir(join(root, 'documents'))).toEqual([])
    })

    /**
     * The renderer names the surfaces and they become ZIP entries the studio writes AND reads
     * back — the one field of this contract that crosses a security boundary. The IPC boundary
     * REFUSES one outright (`validation.test.ts`); this is the packer's own last line, below it,
     * where dropping is right — one odd name must cost that surface, never the whole picture.
     */
    it('drops a surface that would name its way out of the container', async () => {
      await documents.write('doc-1', 'image', {
        title: 'Poster',
        content: oraContent(['data/p_a.png']),
        parts: [...oraParts(['data/p_a.png']), { path: '../escaped.png', png: PIXELS }],
      })

      const paths = (await documents.read('doc-1', 'image'))?.parts?.map(one => one.path) ?? []
      expect(paths).not.toContain('../escaped.png')
      expect(paths).toContain('data/p_a.png')
    })

    /**
     * A body no reader understands would drop the document from every listing while it sat in
     * the folder — the same refusal a montage that is not a timeline gets, and the one place a
     * save can be stopped.
     */
    it('refuses a content that is not a stack', async () => {
      await expect(
        documents.write('doc-1', 'image', { title: 'Poster', content: '{}' }),
      ).rejects.toThrow()

      expect(await documents.list()).toEqual([])
    })

    /**
     * A container written elsewhere may carry no `w`/`h` on its `<image>`, which the unpacker
     * reads as zero. Refusing that on the way OUT makes the document unsaveable for good — the
     * value came from the read, and the write is echoing it back.
     */
    it('saves a container whose stack declares no size', async () => {
      const sizeless = JSON.stringify({ width: 0, height: 0, nodes: [], studio: '{}' })

      await documents.write('doc-1', 'image', {
        title: 'Sans taille',
        content: sizeless,
        parts: oraParts(),
      })

      expect(JSON.parse((await documents.read('doc-1', 'image'))?.content ?? '')).toMatchObject({
        width: 0,
        height: 0,
      })
    })

    it('reads back nothing for a container that was never written', async () => {
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

      const written = await readFile(join(root, 'Rushes.otio'), 'utf8')
      expect(JSON.parse(written)).toMatchObject({ OTIO_SCHEMA: 'Timeline.1', name: 'Rushes' })
      expect(written.startsWith('{')).toBe(true)
    })

    it('stays one file when it is renamed', async () => {
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

  /**
   * The same for the 3D scene, with one difference that is the whole difficulty: `.gltf` serves
   * the scene AND the sky, and the sky still writes the studio's envelope — so this container
   * holds two spellings at once, and the FILE is what tells them apart.
   */
  describe('a scene held as glTF', () => {
    const gltf = (studio: Record<string, unknown> = {}): string =>
      JSON.stringify({
        asset: { version: '2.0' },
        scene: 0,
        scenes: [{ nodes: [], extras: { scenario: studio } }],
        nodes: [],
      })

    // Named after its file, an id being what a document written here carries and this one has not.
    // A glTF with nothing of ours in it is a MESH, and `turns away a file of an open format the
    // studio did not write` is the other half of that rule.
    it('lists one of ours that lost its id, named after its file', async () => {
      await writeFile(join(root, 'Repérage.gltf'), gltf(), 'utf8')

      expect(await documents.list()).toEqual([
        {
          id: 'Repérage',
          kind: 'scene',
          title: 'Repérage',
          workspace: '3d',
          path: 'Repérage.gltf',
        },
      ])
    })

    it('remembers which document one of its own is, whatever the file is called', async () => {
      await writeFile(join(root, 'Repérage.gltf'), gltf({ documentId: 'doc-3' }), 'utf8')

      expect((await documents.list())[0]?.id).toBe('doc-3')
    })

    /**
     * Seen on screen, not deduced: a scene written before the file went compact is indented, so
     * its first line is `{`. Read as an envelope, it dropped out of the listing — the file sat in
     * the folder wearing its extension, and nothing opened it.
     */
    it('lists one written indented, whose first line is not an envelope', async () => {
      const indented = JSON.stringify(JSON.parse(gltf({ documentId: 'doc-3' })), null, 2)
      await writeFile(join(root, 'Repérage.gltf'), indented, 'utf8')

      expect((await documents.list())[0]).toMatchObject({ id: 'doc-3', kind: 'scene' })
    })

    // The defect this change exists to close: a save writing our envelope back would leave a
    // file no other application can read, and the studio would be its only reader again.
    it('writes the scene back with nothing of ours in front of it', async () => {
      const content = gltf({ documentId: 'doc-3', documentKind: 'scene' })
      await writeFile(join(root, 'Repérage.gltf'), content, 'utf8')
      await documents.list()

      expect(await documents.write('doc-3', 'scene', { title: 'Repérage', content })).toBe(
        'written',
      )

      const written = await readFile(join(root, 'Repérage.gltf'), 'utf8')
      expect(JSON.parse(written)).toMatchObject({ asset: { version: '2.0' } })
      expect(JSON.parse(written).scenes[0].name).toBe('Repérage')
    })

    // The sky shares this extension and is NOT glTF yet. Listing it as a scene would open it in
    // the wrong editor, and writing it as one would throw away everything it holds.
    it('still lists a sky written the studio’s own way, under the same extension', async () => {
      await documents.write('sky-1', 'skybox', { title: 'Ciel', content: '{"adjustments":{}}' })

      expect((await documents.list()).map(({ kind, title }) => ({ kind, title }))).toEqual([
        { kind: 'skybox', title: 'Ciel' },
      ])
    })
  })
})

describe('orphanStagingCopies', () => {
  const first = 'doc-1.gltf.3f2a1c88-9d4e-4b7a-8c15-2e6f0a7b9d31.tmp'
  const second = 'doc-2.ora.7c9e0b21-4a5d-4f38-9b62-1d8e3f04a5c7.tmp'

  it('picks the staging copies nobody is holding', () => {
    expect(orphanStagingCopies([first, 'doc-1.gltf', second, 'notes.txt'], new Set())).toEqual([
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
    const entries = ['render.tmp', 'notes.tmp', 'doc-1.gltf', 'tmp.ora', 'a.tmp.gltf']

    expect(orphanStagingCopies(entries, new Set())).toEqual([])
  })
})
