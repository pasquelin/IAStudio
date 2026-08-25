import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { DocumentNameFailure } from '@shared/domain/documentName'
import type { WorkspaceId } from '@shared/domain/workspace'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { installFakeBridge } from '@/services/fakeBridge'
import { holdCanvas } from '@/spaces/image/canvasHosts'
import { installDocuments, retitleDocument } from '@/stores/document-fixtures'
import { installScene } from '@/stores/scene-fixtures'
import { clipFixture, sequenceWith, trackFixture } from '@/engines/timeline/timeline-fixtures'
import { installSequence } from '@/stores/sequence-fixtures'
import { selectTrackIn, sequenceOf, useSequences } from '@/stores/sequences'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { runAction } from './executor'

const openDocument = vi.hoisted(() => vi.fn())
vi.mock('@/app/dockviewApi', () => ({ openDocument, showWorkspace: vi.fn() }))

const closeDocument = vi.hoisted(() => vi.fn(async () => true))
const documentIsDirty = vi.hoisted(() => vi.fn(() => false))
const saveDocument = vi.hoisted(() => vi.fn(async () => true))
const dropDocument = vi.hoisted(() => vi.fn(async () => true))
vi.mock('@/app/documentIo', () => ({
  closeDocument,
  documentIsDirty,
  saveDocument,
  dropDocument,
}))

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
  saveDocument.mockClear()
  saveDocument.mockResolvedValue(true)
  dropDocument.mockClear()
  dropDocument.mockResolvedValue(true)
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

  /**
   * What a spoken request most often means by "it". Answered here rather than left to a second
   * call: the assistant's briefing reads this as a sentence, and a client that had to ask twice
   * would act between the two answers.
   */
  it('says what is designated on the surface in front', async () => {
    const base = createDefaultScene()
    const node = base.nodes[0]
    installScene('doc-scene', { ...base, selectedIds: node ? [node.id] : [] })

    const outcome = await runAction('studio.state', {})

    expect(outcome).toMatchObject({
      ok: true,
      data: { selection: { kind: 'node', items: [{ id: node?.id, name: node?.name }] } },
    })
  })

  // Which TRACK is designated, not the clip that was designated before it: a briefing that read
  // the clip for ever left a spoken « mute this track » with nothing to aim at.
  it('says which track is designated', async () => {
    installSequence('doc-seq')
    installDocuments({ 'doc-seq': 'video' }, 'doc-seq')
    const track = sequenceOf(useSequences.getState(), 'doc-seq').tracks[0]
    selectTrackIn('doc-seq', track?.id ?? '')

    const outcome = await runAction('studio.state', {})

    expect(outcome).toMatchObject({
      ok: true,
      data: { selection: { kind: 'track', items: [{ id: track?.id, name: track?.name }] } },
    })
  })

  /**
   * 🛑 The same answer as the inspector, resolved by `designatedIn`. Written twice, the two
   * diverged on exactly this input: the panel fell back to the clip and the briefing said nothing,
   * so a model was told nothing was designated over a clip the user could see highlighted.
   */
  it('falls back to the clip when the designated row is no longer there', async () => {
    installSequence('doc-seq', {
      ...sequenceWith([trackFixture('V1', 'video', [clipFixture('clip-1', 0, 1_000_000)])]),
      selectedId: 'clip-1',
      selectedTrackId: 'gone',
    })
    installDocuments({ 'doc-seq': 'video' }, 'doc-seq')

    const outcome = await runAction('studio.state', {})

    expect(outcome).toMatchObject({
      ok: true,
      data: { selection: { kind: 'clip', items: [{ id: 'clip-1' }] } },
    })
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
    useDocuments.setState({ stored: [stored('doc-shut', 'Repérages/Niveau.gltf')] })

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

  // Naming the tab in the store alone left an image in front of a sky's panels.
  it('takes the section and the centre with it', async () => {
    installDocuments({ 'doc-a': '3d', 'doc-b': 'image' }, 'doc-a')

    await runAction('document.activate', { documentId: 'doc-b' })

    expect(openDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-b' }))
  })

  /**
   * 🛑 By TITLE, because the id is the one thing a caller may never have seen: the briefing names
   * open documents in quotes and nothing else, so a model told to bring one back to the front had
   * only its title to answer with — and the rule telling it to do so promised a refusal.
   */
  it('takes the title the studio shows, not the id alone', async () => {
    installDocuments({ 'doc-a': '3d', 'doc-b': 'image' }, 'doc-a')
    retitleDocument('doc-b', 'Planche du château')

    expect(await runAction('document.activate', { documentId: 'Planche du château' })).toEqual({
      ok: true,
    })
    expect(useDocuments.getState().activeId).toBe('doc-b')
  })

  // Guessing between two would activate the wrong one in silence, where a refusal sends the
  // caller to `documents.list` for the id that tells them apart.
  it('refuses a title two documents share rather than picking one', async () => {
    installDocuments({ 'doc-a': '3d', 'doc-b': 'image' }, 'doc-a')
    retitleDocument('doc-a', 'Château')
    retitleDocument('doc-b', 'Château')

    expect(await runAction('document.activate', { documentId: 'Château' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
    expect(useDocuments.getState().activeId).toBe('doc-a')
  })

  it('refuses an id no tab holds rather than clearing the centre', async () => {
    installDocuments({ 'doc-a': '3d' }, 'doc-a')

    expect(await runAction('document.activate', { documentId: 'doc-z' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
    expect(useDocuments.getState().activeId).toBe('doc-a')
    expect(openDocument).not.toHaveBeenCalled()
  })

  it('opens a document of the folder by its path', async () => {
    installDocuments({}, '')
    useDocuments.setState({ stored: [stored('doc-shut', 'Repérages/Niveau.gltf')] })

    expect(await runAction('document.open', { path: 'Repérages/Niveau.gltf' })).toEqual({
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
      useDocuments.setState({ stored: [stored('doc-new', 'Sorties/Rendu.gltf')] })
    })
    useDocuments.setState({ relist })

    expect(await runAction('document.open', { path: 'Sorties/Rendu.gltf' })).toMatchObject({
      ok: true,
    })
    expect(relist).toHaveBeenCalled()
  })

  // `badInput` sent a client back to check a path that was well formed all along, when the only
  // true answer was that nothing sits there.
  it('says the document is not there rather than blaming the parameters', async () => {
    installDocuments({}, '')

    expect(await runAction('document.open', { path: 'Nowhere/Absent.ora' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
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

/**
 * The only export an outside client can ask for. Every other export channel raises a native picker
 * nobody outside can fill, and the destination here is NAMED rather than pointed at — which is why
 * it is held inside the project by the main process rather than trusted.
 */
describe('exporting the document in front', () => {
  /** A one-pixel PNG, base64, which is what a mounted engine hands its snapshot over as. */
  const PIXEL = 'data:image/png;base64,iVBORw0KGgo='

  const withImage = (): void => {
    installDocuments({ 'doc-b': 'image' }, 'doc-b')
    holdCanvas('doc-b', () => ({
      pixelSnapshots: async () => [],
      restoreSnapshot: async () => {},
      flatten: async () => new Uint8Array(0),
      snapshot: async () => PIXEL,
      forgetPicture: async () => {},
      turnQuarter: () => undefined,
    }))
  }

  it('renders the image in front and writes it under its own title', async () => {
    withImage()
    const exportInto = vi.fn(async () => 'doc-b')
    installFakeBridge({ project: { exportInto } })

    expect(await runAction('document.export', {})).toEqual({ ok: true, data: 'doc-b' })
    expect(exportInto).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'doc-b',
        files: [expect.objectContaining({ extension: '.png' })],
      }),
    )
  })

  // Each door used to leave the fallback to `safeFileName`, whose own default is `texture`: a
  // title made of separators is cleaned down to nothing, and the picture came out named `texture`.
  it('names a picture with no usable title after its own space', async () => {
    withImage()
    retitleDocument('doc-b', '///')
    const exportInto = vi.fn(async () => 'image')
    installFakeBridge({ project: { exportInto } })

    await runAction('document.export', {})

    expect(exportInto).toHaveBeenCalledWith(expect.objectContaining({ folder: 'image' }))
  })

  it('writes into the folder it was given rather than the title', async () => {
    withImage()
    const exportInto = vi.fn(async () => 'Rendus')
    installFakeBridge({ project: { exportInto } })

    await runAction('document.export', { folder: 'Rendus' })
    expect(exportInto).toHaveBeenCalledWith(expect.objectContaining({ folder: 'Rendus' }))
  })

  /**
   * A montage answers with its CUT, not with a film: the film needs a session the viewport
   * drives and a client cannot hold, while the `.otio` is one encoding of plain data. This case
   * asserted the refusal until the montage got that encoding.
   */
  it.each<WorkspaceId>(['video', 'audio'])('writes the cut of a %s montage', async workspace => {
    installDocuments({ 'doc-m': workspace }, 'doc-m')
    const exportInto = vi.fn(async () => 'doc-m')
    installFakeBridge({ project: { exportInto } })

    expect(await runAction('document.export', {})).toEqual({ ok: true, data: 'doc-m' })
    expect(exportInto).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'doc-m',
        files: [expect.objectContaining({ extension: '.otio' })],
      }),
    )
  })

  // Same question as the picture above, on the last door that still left the fallback to
  // `safeFileName`: a montage with no usable title came out named after the texture space.
  it('names a montage with no usable title after its own space', async () => {
    installDocuments({ 'doc-m': 'video' }, 'doc-m')
    retitleDocument('doc-m', '...')
    const exportInto = vi.fn(async () => 'edit')
    installFakeBridge({ project: { exportInto } })

    await runAction('document.export', {})

    expect(exportInto).toHaveBeenCalledWith(expect.objectContaining({ folder: 'edit' }))
  })

  // The one way a montage cannot be encoded: its clips point at catalogue rows, and without a
  // project there is no path to resolve them to.
  it('refuses a montage when no project is open', async () => {
    installDocuments({ 'doc-m': 'video' }, 'doc-m')
    useProject.setState({ project: null, known: true })
    const exportInto = vi.fn(async () => null)
    installFakeBridge({ project: { exportInto } })

    expect(await runAction('document.export', {})).toEqual({
      ok: false,
      refusal: 'notRenderable',
    })
    expect(exportInto).not.toHaveBeenCalled()
  })

  // Every rendering throws rather than answering half an export — here, an engine that is not
  // mounted, which is what a headless test always is.
  it('refuses rather than writing half an export when the rendering fails', async () => {
    installDocuments({ 'doc-s': 'skyboxes' }, 'doc-s')
    const exportInto = vi.fn(async () => null)
    installFakeBridge({ project: { exportInto } })

    expect(await runAction('document.export', {})).toEqual({
      ok: false,
      refusal: 'notRenderable',
    })
    expect(exportInto).not.toHaveBeenCalled()
  })

  it('refuses with no document in front at all', async () => {
    installDocuments({}, '')

    expect(await runAction('document.export', {})).toEqual({ ok: false, refusal: 'wrongSurface' })
  })
})

/**
 * The two verbs an outside client had no way to reach. Creating one was already possible
 * (`workspace.open` with `createDocument`), and so was trashing a file (`files.trash`) — what was
 * missing is a save it can WAIT on, and a delete at all.
 */
describe('saving a document from outside the window', () => {
  it('saves the document it names, and says whether anything was written', async () => {
    installDocuments({ 'doc-a': '3d', 'doc-b': 'image' }, 'doc-b')

    expect(await runAction('document.save', { documentId: 'doc-a' })).toEqual({
      ok: true,
      data: { written: true },
    })
    expect(saveDocument).toHaveBeenCalledWith('doc-a')
  })

  // `command.run('document.save')` could only ever reach the tab in front, and answered before
  // the write landed. Naming one is the whole point of this action.
  it('falls back on the document in front when none is named', async () => {
    installDocuments({ 'doc-a': '3d', 'doc-b': 'image' }, 'doc-b')

    await runAction('document.save', {})

    expect(saveDocument).toHaveBeenCalledWith('doc-b')
  })

  // An untouched tab has nothing to write. A client told `failed` would retry it for ever.
  it('answers that nothing was written rather than refusing', async () => {
    installDocuments({ 'doc-a': '3d' }, 'doc-a')
    saveDocument.mockResolvedValue(false)

    expect(await runAction('document.save', {})).toEqual({ ok: true, data: { written: false } })
  })

  it('refuses for a document no tab holds', async () => {
    installDocuments({ 'doc-a': '3d' }, 'doc-a')

    expect(await runAction('document.save', { documentId: 'ghost' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
    expect(saveDocument).not.toHaveBeenCalled()
  })

  /**
   * An image whose engine is still booting its GPU context throws rather than writing a container
   * with no pixels. Across this boundary that has to be a refusal, and the same one an export
   * gives for the same cause.
   */
  it('refuses rather than throwing when the editor cannot hand its pixels over', async () => {
    installDocuments({ 'doc-b': 'image' }, 'doc-b')
    saveDocument.mockRejectedValue(new Error('its pixels cannot be read'))

    expect(await runAction('document.save', {})).toEqual({
      ok: false,
      refusal: 'notRenderable',
    })
  })
})

describe('deleting a document from outside the window', () => {
  /**
   * `dropDocument` and not `deleteDocument`: the tab menu's route raises a NATIVE dialog, which
   * nobody on the other side of the machine can answer — the call would stand there for good.
   * The assistant's own gate is what stands in front of this one.
   */
  it('deletes without raising a dialog nobody can answer', async () => {
    installDocuments({ 'doc-a': '3d' }, 'doc-a')

    expect(await runAction('document.remove', { documentId: 'doc-a' })).toEqual({ ok: true })
    expect(dropDocument).toHaveBeenCalledWith('doc-a')
  })

  it('refuses for a document no tab holds', async () => {
    installDocuments({ 'doc-a': '3d' }, 'doc-a')

    expect(await runAction('document.remove', { documentId: 'ghost' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
    expect(dropDocument).not.toHaveBeenCalled()
  })

  it('says it did not go through rather than reporting a deletion that never happened', async () => {
    installDocuments({ 'doc-a': '3d' }, 'doc-a')
    dropDocument.mockResolvedValue(false)

    expect(await runAction('document.remove', { documentId: 'doc-a' })).toEqual({
      ok: false,
      refusal: 'failed',
    })
  })
})
