import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { WorkspaceId } from '@shared/domain/workspace'
import { pushEdit } from '@/engines/audio/edits'
import { canUndo } from '@/engines/core/history'
import { bridgeWatchingLogs, installFakeBridge } from '@/services/fake-bridge'
import { audioEditsOf, audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { installDocument, installDocuments } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { sequenceOf, useSequences, writeTrack } from '@/stores/sequences'
import { sceneOf, useScenes } from '@/stores/scenes'
import { skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { openAsset } from './open-asset'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'pad.wav',
  type: 'audio',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

/** The workspace, not the kind: `installDocument` derives the pairing the application uses. */
const open = (workspace: WorkspaceId): void => installDocument('doc-1', workspace)

const picture = (overrides: Partial<Asset> = {}): Asset =>
  asset({ id: 'asset-sky', name: 'dusk.png', type: 'image', ...overrides })

describe('opening an asset', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    useAudioEdits.setState({ states: {}, histories: {} })
    useSequences.setState({ states: {}, histories: {} })
    useSkyboxes.setState({ states: {}, histories: {} })
    useCanvases.setState({ states: {}, histories: {} })
    // Not the default one: a test that watches the workspace change must not start at its target.
    useLayouts.setState({ layouts: {}, activeWorkspace: '3d' })
  })

  it('points the audio editor at a take when an audio tab is in front', async () => {
    open('audio')
    await openAsset(asset())

    expect(audioEditsOf(useAudioEdits.getState(), 'doc-1').assetId).toBe('asset-1')
  })

  it('adds to the montage when a sequence is in front', async () => {
    open('video')
    await openAsset(asset())

    expect(sequenceOf(useSequences.getState(), 'doc-1').tracks[1]?.clips).toHaveLength(1)
  })

  it('leaves the audio editor alone for an asset it cannot play', async () => {
    open('audio')
    await openAsset(asset({ type: 'image' }))

    expect(audioEditsOf(useAudioEdits.getState(), 'doc-1').assetId).toBeNull()
  })

  it('lays a picture down as a layer when an image tab is in front', async () => {
    open('image')
    await openAsset(picture())

    expect(canvasOf(useCanvases.getState(), 'doc-1').layers.at(-1)?.name).toBe('dusk.png')
  })

  // The canvas takes pictures, and nothing else: a sound double-clicked over an image tab must
  // fall through rather than become a layer of silence.
  it('leaves the canvas alone for an asset it cannot hold', async () => {
    open('image')
    await openAsset(asset())

    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(1)
  })

  it('does nothing at all when no document can take it', () => {
    expect(() => openAsset(asset())).not.toThrow()
    expect(useSequences.getState().states).toEqual({})
  })

  // The explorer opens a document wherever it belongs, switching workspace on the way. An asset
  // used to refuse to cross: it only ever landed in the tab already in front.
  it('crosses to a tab that can take it and brings it forward', async () => {
    installDocuments({ 'doc-scene': '3d', 'doc-image': 'image' }, 'doc-scene')
    await openAsset(picture())

    expect(canvasOf(useCanvases.getState(), 'doc-image').layers.at(-1)?.name).toBe('dusk.png')
    expect(useLayouts.getState().activeWorkspace).toBe('image')
  })

  // Crossing must not become a habit: the tab under the eye is where a double-click lands, and
  // the cascade of `ASSET_INTENTS` only decides between the ones it is NOT looking at.
  it('prefers the tab in front over the first destination of the cascade', async () => {
    installDocuments({ 'doc-sky': 'skyboxes', 'doc-image': 'image' }, 'doc-image')
    await openAsset(picture())

    expect(canvasOf(useCanvases.getState(), 'doc-image').layers.at(-1)?.name).toBe('dusk.png')
    expect(skyboxOf(useSkyboxes.getState(), 'doc-sky').source).toBeNull()
  })

  /**
   * A tab that has never been on screen holds no state. Writing into it straight away makes
   * `restoreDocument` take it for one already loaded: its file is never read, the editor opens
   * holding nothing but the asset just dropped, and the next save writes that over the file.
   */
  it('lets the tab it crosses to load before writing into it', async () => {
    installFakeBridge({ documents: { read: () => Promise.resolve(null) } })
    installDocuments({ 'doc-image': 'image', 'doc-scene': '3d' }, 'doc-image')

    await openAsset(asset({ id: 'mesh-1', type: 'mesh', name: 'chair.glb' }))

    const nodes = sceneOf(useScenes.getState(), 'doc-scene').nodes
    expect(nodes.filter(node => node.type === 'model')).toHaveLength(1)
    // A new scene is born lit, and a document read from disk brings its own nodes. Writing
    // before either happened left the tab holding nothing but the asset.
    expect(nodes.filter(node => node.type !== 'model').length).toBeGreaterThan(0)
  })

  // The montage takes every kind, so it is the destination the cascade falls back to — and the
  // one that used to switch workspace to write nothing, when no track would hold the asset.
  it('does not cross to a montage whose tracks all refuse the asset', async () => {
    const { entries } = bridgeWatchingLogs()
    installDocuments({ 'doc-image': 'image', 'doc-seq': 'video' }, 'doc-image')
    for (const track of sequenceOf(useSequences.getState(), 'doc-seq').tracks) {
      writeTrack('doc-seq', track.id, locked => ({ ...locked, locked: true }))
    }

    await openAsset(asset({ name: 'pad.wav' }))

    expect(useLayouts.getState().activeWorkspace).toBe('3d')
    expect(entries()).toHaveLength(1)
  })

  // A refusal nobody hears is what made this gesture untrustworthy: the same double-click that
  // works over one tab did nothing at all over another, and said nothing either way.
  it('says so when nothing in the project can take it', async () => {
    const { entries } = bridgeWatchingLogs()
    open('audio')

    await openAsset(picture({ type: 'mesh', name: 'chair.glb' }))

    expect(entries()).toHaveLength(1)
    expect(entries()[0]).toMatchObject({ scope: 'assets.open' })
    expect(entries()[0]?.message).toContain('chair.glb')
  })

  it('keeps quiet when the asset did land somewhere', async () => {
    const { entries } = bridgeWatchingLogs()
    open('image')

    await openAsset(picture())

    expect(entries()).toHaveLength(0)
  })

  it('drops the chain when the editor is pointed at another take', async () => {
    open('audio')
    await openAsset(asset())
    useAudioEdits.getState().runCommand('doc-1', pushEdit({ kind: 'trimSilence' }))

    await openAsset(asset({ id: 'asset-2', name: 'pad.wav' }))

    // A crop measured against one take describes nothing on the next, and "apply" would write
    // that nothing over the file.
    const edits = audioEditsOf(useAudioEdits.getState(), 'doc-1')
    expect(edits).toMatchObject({ assetId: 'asset-2', edits: [], region: null, bypassed: false })
    expect(canUndo(audioHistoryOf(useAudioEdits.getState(), 'doc-1'))).toBe(false)
  })

  it('hangs a picture in the sky when a skybox tab is in front', async () => {
    open('skyboxes')
    await openAsset(picture())

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toEqual({ assetId: 'asset-sky' })
  })

  // The same equirectangular file is an `image` when imported and a `skybox` when generated;
  // which shelf it came from must not decide whether it can be hung.
  it('takes a generated sky as readily as an imported picture', async () => {
    open('skyboxes')
    await openAsset(picture({ type: 'skybox' }))

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toEqual({ assetId: 'asset-sky' })
  })

  // The panel shows this field under "what produced this sky". Left in place, it would credit
  // the prompt of a generated sky with the photograph that has just replaced it.
  it('clears the provenance of the sky it replaces', async () => {
    open('skyboxes')
    useSkyboxes.getState().replace('doc-1', {
      ...skyboxOf(useSkyboxes.getState(), 'doc-1'),
      generation: { modelId: 'model_sky', modelLabel: 'Skybox Flux.1', prompt: 'a dusk' },
    })

    await openAsset(picture())

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').generation).toBeUndefined()
  })

  it('refuses what does not decode as a picture', async () => {
    open('skyboxes')
    await openAsset(asset({ type: 'video' }))

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toBeNull()
  })

  // A cloud asset has no file the engine could load: `assetUrl` resolves an id against the
  // catalogue, and one that is not on disk answers 404 into a black sky.
  it('refuses a picture that is not on disk', async () => {
    open('skyboxes')
    await openAsset(picture({ location: 'cloud' }))

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toBeNull()
  })

  it('leaves the sky undoable back to the one before it', async () => {
    open('skyboxes')
    await openAsset(picture())
    await openAsset(picture({ id: 'asset-dawn' }))

    useSkyboxes.getState().undo('doc-1')
    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toEqual({ assetId: 'asset-sky' })
  })

  it('keeps the chain when the same take is opened again', async () => {
    open('audio')
    await openAsset(asset())
    useAudioEdits.getState().runCommand('doc-1', pushEdit({ kind: 'trimSilence' }))

    await openAsset(asset())

    expect(audioEditsOf(useAudioEdits.getState(), 'doc-1').edits).toHaveLength(1)
  })
})
