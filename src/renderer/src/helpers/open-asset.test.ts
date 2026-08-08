import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { WorkspaceId } from '@shared/domain/workspace'
import { pushEdit } from '@/engines/audio/edits'
import { canUndo } from '@/engines/core/history'
import { audioEditsOf, audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { registerCanvas } from '@/spaces/image/canvas-hosts'
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
  })

  it('points the audio editor at a take when an audio tab is in front', () => {
    open('audio')
    openAsset(asset())

    expect(audioEditsOf(useAudioEdits.getState(), 'doc-1').assetId).toBe('asset-1')
  })

  it('adds to the montage when a sequence is in front', () => {
    open('video')
    openAsset(asset())

    expect(sequenceOf(useSequences.getState(), 'doc-1').tracks[1]?.clips).toHaveLength(1)
  })

  it('leaves the audio editor alone for an asset it cannot play', () => {
    open('audio')
    openAsset(asset({ type: 'image' }))

    expect(audioEditsOf(useAudioEdits.getState(), 'doc-1').assetId).toBeNull()
  })

  it('lays a picture down as a layer when an image tab is in front', async () => {
    open('image')
    const release = registerCanvas('doc-1', { loadInto: () => Promise.resolve() })
    openAsset(picture())

    await waitFor(() =>
      expect(canvasOf(useCanvases.getState(), 'doc-1').layers.at(-1)?.name).toBe('dusk.png'),
    )
    release()
  })

  // The canvas takes pictures, and nothing else: a sound double-clicked over an image tab must
  // fall through rather than become a layer of silence.
  it('leaves the canvas alone for an asset it cannot hold', () => {
    open('image')
    const release = registerCanvas('doc-1', { loadInto: () => Promise.resolve() })
    openAsset(asset())

    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(1)
    release()
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
    open('skyboxes')
    openAsset(picture())

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toEqual({ assetId: 'asset-sky' })
  })

  // The same equirectangular file is an `image` when imported and a `skybox` when generated;
  // which shelf it came from must not decide whether it can be hung.
  it('takes a generated sky as readily as an imported picture', () => {
    open('skyboxes')
    openAsset(picture({ type: 'skybox' }))

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toEqual({ assetId: 'asset-sky' })
  })

  // The panel shows this field under "what produced this sky". Left in place, it would credit
  // the prompt of a generated sky with the photograph that has just replaced it.
  it('clears the provenance of the sky it replaces', () => {
    open('skyboxes')
    useSkyboxes.getState().replace('doc-1', {
      ...skyboxOf(useSkyboxes.getState(), 'doc-1'),
      generation: { modelId: 'model_sky', modelLabel: 'Skybox Flux.1', prompt: 'a dusk' },
    })

    openAsset(picture())

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').generation).toBeUndefined()
  })

  it('refuses what does not decode as a picture', () => {
    open('skyboxes')
    openAsset(asset({ type: 'video' }))

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toBeNull()
  })

  // A cloud asset has no file the engine could load: `assetUrl` resolves an id against the
  // catalogue, and one that is not on disk answers 404 into a black sky.
  it('refuses a picture that is not on disk', () => {
    open('skyboxes')
    openAsset(picture({ location: 'cloud' }))

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toBeNull()
  })

  it('leaves the sky undoable back to the one before it', () => {
    open('skyboxes')
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
