import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset, AssetType } from '@shared/domain/asset'
import { pushEdit } from '@/engines/audio/edits'
import { canUndo } from '@/engines/core/history'
import { audioEditsOf, audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { useDocuments } from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { skyboxOf, useSkyboxes } from '@/stores/skyboxes'
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

const open = (kind: 'audio' | 'sequence' | 'skybox'): void => {
  useDocuments.setState({
    documents: { 'doc-1': { id: 'doc-1', kind, title: 'Doc', workspace: 'audio' } },
    activeId: 'doc-1',
  })
}

/** Every kind that decodes as an image — the same file may have arrived under any of them. */
const PICTURE_TYPES: readonly AssetType[] = ['image', 'texture', 'skybox']

const picture = (overrides: Partial<Asset> = {}): Asset =>
  asset({ id: 'asset-sky', name: 'dusk.png', type: 'image', ...overrides })

describe('opening an asset', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    useAudioEdits.setState({ states: {}, histories: {} })
    useSequences.setState({ states: {}, histories: {} })
    useSkyboxes.setState({ states: {}, histories: {} })
  })

  it('points the audio editor at a take when an audio tab is in front', () => {
    open('audio')
    openAsset(asset())

    expect(audioEditsOf(useAudioEdits.getState(), 'doc-1').assetId).toBe('asset-1')
  })

  it('adds to the montage when a sequence is in front', () => {
    open('sequence')
    openAsset(asset())

    expect(sequenceOf(useSequences.getState(), 'doc-1').tracks[1]?.clips).toHaveLength(1)
  })

  it('leaves the audio editor alone for an asset it cannot play', () => {
    open('audio')
    openAsset(asset({ type: 'image' }))

    expect(audioEditsOf(useAudioEdits.getState(), 'doc-1').assetId).toBeNull()
  })

  it('does nothing at all when no document can take it', () => {
    expect(() => openAsset(asset())).not.toThrow()
    expect(useSequences.getState().states).toEqual({})
  })

  it('drops the chain when the editor is pointed at another take', () => {
    open('audio')
    openAsset(asset())
    useAudioEdits.getState().runCommand('doc-1', pushEdit({ kind: 'trimSilence' }))

    openAsset(asset({ id: 'asset-2', name: 'pad.wav' }))

    // A crop measured against one take describes nothing on the next, and "apply" would write
    // that nothing over the file.
    const edits = audioEditsOf(useAudioEdits.getState(), 'doc-1')
    expect(edits).toMatchObject({ assetId: 'asset-2', edits: [], region: null, bypassed: false })
    expect(canUndo(audioHistoryOf(useAudioEdits.getState(), 'doc-1'))).toBe(false)
  })

  it('hangs a picture in the sky when a skybox tab is in front', () => {
    open('skybox')
    openAsset(picture())

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toEqual({ assetId: 'asset-sky' })
  })

  // Every picture the project holds: an equirectangular one may have been imported as a plain
  // image, generated as a skybox, or produced as a texture, and the three are the same file.
  it('takes any picture, whichever shelf it came from', () => {
    open('skybox')

    for (const type of PICTURE_TYPES) {
      useSkyboxes.setState({ states: {}, histories: {} })
      openAsset(picture({ type }))
      expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).not.toBeNull()
    }
  })

  it('refuses what does not decode as a picture', () => {
    open('skybox')
    openAsset(asset({ type: 'video' }))

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toBeNull()
  })

  // A cloud asset has no file the engine could load: `assetUrl` resolves an id against the
  // catalogue, and one that is not on disk answers 404 into a black sky.
  it('refuses a picture that is not on disk', () => {
    open('skybox')
    openAsset(picture({ location: 'cloud' }))

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toBeNull()
  })

  it('leaves the sky undoable back to the one before it', () => {
    open('skybox')
    openAsset(picture())
    openAsset(picture({ id: 'asset-dawn' }))

    useSkyboxes.getState().undo('doc-1')
    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toEqual({ assetId: 'asset-sky' })
  })

  it('keeps the chain when the same take is opened again', () => {
    open('audio')
    openAsset(asset())
    useAudioEdits.getState().runCommand('doc-1', pushEdit({ kind: 'trimSilence' }))

    openAsset(asset())

    expect(audioEditsOf(useAudioEdits.getState(), 'doc-1').edits).toHaveLength(1)
  })
})
