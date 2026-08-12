import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { Project } from '@shared/domain/project'
import { pushEdit } from '@/engines/audio/edits'
import { canUndo } from '@/engines/core/history'
import { bridgeWatchingLogs, installFakeBridge } from '@/services/fake-bridge'
import { audioEditsOf, audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { sceneOf, useScenes } from '@/stores/scenes'
import { skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { openAsset } from './open-asset'

/** Written out rather than taken from the home's fixture, which pulls in a DOM this never uses. */
const PROJECT: Project = {
  path: '/projects/demo',
  manifest: {
    version: 1,
    name: 'Demo',
    createdAt: '2026-08-07T10:00:00.000Z',
    updatedAt: '2026-08-07T10:00:00.000Z',
  },
}

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'pad.wav',
  type: 'audio',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

const picture = (overrides: Partial<Asset> = {}): Asset =>
  asset({ id: 'asset-sky', name: 'dusk.png', type: 'image', ...overrides })

/** The tab the gesture made. Every case here opens exactly one, which is the promise itself. */
function opened(): DocumentDescriptor {
  const documents = Object.values(useDocuments.getState().documents)
  const made = documents.at(-1)
  if (!made) throw new Error('expected a document to have been opened')
  return made
}

const openedCount = (): number => Object.keys(useDocuments.getState().documents).length

/**
 * Opening an asset means editing it: a tab of its own, in the space that edits its kind.
 *
 * The rule has no exception, and that is the point of it. The gesture used to read the tab in
 * front — a picture became a layer over an image tab and a sky over a skybox one — so one
 * double-click meant two things, and neither of them was "open this asset". Placing into the
 * document already open is what the context menu and the drag are for.
 */
describe('opening an asset', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, stored: [], activeId: null })
    useAudioEdits.setState({ states: {}, histories: {} })
    useSequences.setState({ states: {}, histories: {} })
    useSkyboxes.setState({ states: {}, histories: {} })
    useScenes.setState({ states: {}, histories: {} })
    useCanvases.setState({ states: {}, histories: {} })
    // Not the target of any case below: a test watching the workspace change must not start on it.
    useLayouts.setState({ layouts: {}, activeWorkspace: 'graph' })
    useProject.setState({ project: PROJECT, known: true })
    installFakeBridge()
  })

  it('opens a take in the audio editor, in a tab of its own', async () => {
    await openAsset(asset())

    expect(audioEditsOf(useAudioEdits.getState(), opened().id).assetId).toBe('asset-1')
    expect(useLayouts.getState().activeWorkspace).toBe('audio')
  })

  it('opens a picture as a layer of an image document', async () => {
    await openAsset(picture())

    expect(canvasOf(useCanvases.getState(), opened().id).layers.at(-1)?.name).toBe('dusk.png')
    expect(useLayouts.getState().activeWorkspace).toBe('image')
  })

  it('opens a mesh in a scene', async () => {
    await openAsset(asset({ id: 'mesh-1', type: 'mesh', name: 'chair.glb' }))

    const nodes = sceneOf(useScenes.getState(), opened().id).nodes
    expect(nodes.filter(node => node.type === 'model')).toHaveLength(1)
    expect(useLayouts.getState().activeWorkspace).toBe('3d')
  })

  it('opens a sky in the skybox space, not in the image one it also decodes for', async () => {
    await openAsset(picture({ type: 'skybox' }))

    expect(skyboxOf(useSkyboxes.getState(), opened().id).source).toEqual({ assetId: 'asset-sky' })
    expect(useLayouts.getState().activeWorkspace).toBe('skyboxes')
  })

  it('opens a video in a montage of its own', async () => {
    await openAsset(asset({ id: 'clip-1', type: 'video', name: 'rush.mp4' }))

    const tracks = sequenceOf(useSequences.getState(), opened().id).tracks
    expect(tracks.flatMap(track => track.clips)).toHaveLength(1)
  })

  it('names the tab after the asset, and links it back', async () => {
    await openAsset(picture({ name: 'Gemini 3.1' }))

    expect(opened()).toMatchObject({ title: 'Gemini 3.1', sourceAssetId: 'asset-sky' })
  })

  /**
   * The rule with no exception. A skybox tab in front takes a picture perfectly well — that is
   * what the context menu offers — but the double-click is about the asset, not about the tab.
   */
  it('ignores the tab in front, whatever it would have taken', async () => {
    installDocument('doc-sky', 'skyboxes')

    await openAsset(picture())

    expect(skyboxOf(useSkyboxes.getState(), 'doc-sky').source).toBeNull()
    expect(useLayouts.getState().activeWorkspace).toBe('image')
    expect(openedCount()).toBe(2)
  })

  /**
   * Two tabs onto one asset are two histories of it, and the second save writes over the first.
   */
  it('comes back to the tab already editing the asset', async () => {
    await openAsset(picture())
    const first = opened()

    await openAsset(picture())

    expect(openedCount()).toBe(1)
    expect(opened().id).toBe(first.id)
  })

  /**
   * The half that matters most, and the one open tabs alone cannot answer: a document saved for
   * an asset and then closed lives only in the folder listing. Read from `documents` only, the
   * gesture built a second document beside the very work it was meant to reopen.
   */
  it('reopens the document saved for an asset even once its tab is closed', async () => {
    const saved: DocumentDescriptor = {
      id: 'doc-saved',
      kind: 'image',
      workspace: 'image',
      title: 'dusk.png',
      sourceAssetId: 'asset-sky',
    }
    useDocuments.setState({ documents: {}, stored: [saved], activeId: null })

    await openAsset(picture())

    expect(useDocuments.getState().documents['doc-saved']).toBeDefined()
    expect(openedCount()).toBe(1)
  })

  /**
   * The home covers a centre whose Dockview is unmounted, while the module still holds the api
   * of the workspace last mounted. `openDocument` only switches workspace when the document
   * belongs to another one — so on the same one it would add a panel to a discarded api, and
   * the double-click would paint nothing at all.
   */
  it('leaves the home, even for an asset of the workspace already settled on', async () => {
    useLayouts.setState({ layouts: {}, activeWorkspace: 'image', home: true })

    await openAsset(picture())

    expect(useLayouts.getState().home).toBe(false)
  })

  it('leaves the home when it comes back to a tab too', async () => {
    await openAsset(picture())
    useLayouts.setState({ home: true })

    await openAsset(picture())

    expect(useLayouts.getState().home).toBe(false)
  })

  // Same kind, another asset: the tab is not reused, because it is that asset's tab.
  it('opens a second tab for a second asset of the same kind', async () => {
    await openAsset(picture())
    await openAsset(picture({ id: 'asset-2', name: 'dawn.png' }))

    expect(openedCount()).toBe(2)
  })

  /**
   * A document is a file in a project folder, so without one there is nowhere to write it.
   * `create` alone would post a descriptor for a tab that can never be saved.
   */
  it('opens nothing at all with no project, and says why', async () => {
    const { entries } = bridgeWatchingLogs()
    useProject.setState({ project: null, known: true })

    await openAsset(picture())

    expect(openedCount()).toBe(0)
    expect(entries()).toHaveLength(1)
    expect(entries()[0]).toMatchObject({ scope: 'assets.open' })
  })

  /**
   * A cloud asset has no file the engine could load: `assetUrl` resolves an id against the
   * catalogue, and one that is not on disk answers 404 into a black canvas. The refusal has to
   * come BEFORE the tab is made — an empty editor standing where a refusal belonged says less
   * than nothing.
   */
  it('refuses a picture that is not on disk rather than opening an empty tab', async () => {
    const { entries } = bridgeWatchingLogs()

    await openAsset(picture({ location: 'cloud' }))

    expect(openedCount()).toBe(0)
    expect(entries()).toHaveLength(1)
    expect(entries()[0]?.message).toContain('dusk.png')
  })

  /**
   * The picture kinds are refused by their destination's own guard; a take, a mesh and a rush
   * have none, and each would have opened an editor onto a reference resolving to a 404. Every
   * editor loads its subject from the file behind it, so the gesture asks once, for all of them.
   */
  it('refuses every kind the cloud still holds, not only the pictures', async () => {
    const { entries } = bridgeWatchingLogs()

    await openAsset(asset({ location: 'cloud' }))
    await openAsset(asset({ id: 'mesh-1', type: 'mesh', name: 'chair.glb', location: 'cloud' }))
    await openAsset(asset({ id: 'clip-1', type: 'video', name: 'rush.mp4', location: 'cloud' }))

    expect(openedCount()).toBe(0)
    expect(entries()).toHaveLength(3)
  })

  it('keeps quiet when the asset did land somewhere', async () => {
    const { entries } = bridgeWatchingLogs()

    await openAsset(picture())

    expect(entries()).toHaveLength(0)
  })

  /**
   * A tab that has never been on screen holds no state. Writing into it straight away makes
   * `restoreDocument` take it for one already loaded: its file is never read, the editor opens
   * holding nothing but the asset just placed, and the next save writes that over the file.
   */
  it('lets the tab load before writing into it', async () => {
    installFakeBridge({ documents: { read: () => Promise.resolve(null) } })

    await openAsset(asset({ id: 'mesh-1', type: 'mesh', name: 'chair.glb' }))

    // A new scene is born lit, and a document read from disk brings its own nodes. Writing
    // before either happened left the tab holding nothing but the asset.
    const nodes = sceneOf(useScenes.getState(), opened().id).nodes
    expect(nodes.filter(node => node.type !== 'model').length).toBeGreaterThan(0)
  })

  /**
   * A chain is a length and a region measured against the take it was made on. Carried over to
   * another take it describes nothing, and "apply" would write that nothing over the file.
   */
  it('drops the chain when a take is loaded into a tab pointed elsewhere', async () => {
    await openAsset(asset())
    const tab = opened().id
    useAudioEdits.getState().runCommand(tab, pushEdit({ kind: 'trimSilence' }))

    // The tab is the asset's, so the second take reaches it the way a drop does.
    const { loadTake } = await import('@/spaces/audio/load-take')
    loadTake(tab, asset({ id: 'asset-2' }))

    const edits = audioEditsOf(useAudioEdits.getState(), tab)
    expect(edits).toMatchObject({ assetId: 'asset-2', edits: [], region: null, bypassed: false })
    expect(canUndo(audioHistoryOf(useAudioEdits.getState(), tab))).toBe(false)
  })

  // The panel shows this field under "what produced this sky". Left in place, it would credit
  // the prompt of a generated sky with the photograph that has just replaced it.
  it('clears the provenance of the sky it replaces', async () => {
    await openAsset(picture({ type: 'skybox' }))
    const tab = opened().id
    useSkyboxes.getState().replace(tab, {
      ...skyboxOf(useSkyboxes.getState(), tab),
      generation: { modelId: 'model_sky', modelLabel: 'Skybox Flux.1', prompt: 'a dusk' },
    })

    const { setSkyboxSource } = await import('@/stores/skyboxes')
    setSkyboxSource(tab, picture({ id: 'asset-2' }))

    expect(skyboxOf(useSkyboxes.getState(), tab).generation).toBeUndefined()
  })
})
