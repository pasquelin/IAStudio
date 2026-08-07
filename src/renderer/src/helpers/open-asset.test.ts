import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { audioEditsOf, useAudioEdits } from '@/stores/audio-edits'
import { useDocuments } from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { openAsset } from './open-asset'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'nappe.wav',
  type: 'audio',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

const open = (kind: 'audio' | 'sequence'): void => {
  useDocuments.setState({
    documents: { 'doc-1': { id: 'doc-1', kind, title: 'Doc', workspace: 'audio' } },
    activeId: 'doc-1',
  })
}

describe('opening an asset', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    useAudioEdits.setState({ states: {}, histories: {} })
    useSequences.setState({ states: {}, histories: {} })
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
})
