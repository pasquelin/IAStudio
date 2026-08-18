import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClipSource } from '@shared/domain/scene'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from '@/stores/assets'
import { useModelClips } from '@/stores/modelClips'
import { useScenes } from '@/stores/scenes'
import { useSceneViews } from '@/stores/sceneViews'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { modelNodeFixture } from '@/engines/scene/scene-fixtures'
import { AnimationPicker } from './AnimationPicker'

const DOCUMENT = 'doc-1'

const bundled = [{ name: 'Capoeira', thumbnail: true }]

function show(laid: { clipId: string; source: ClipSource } | null = null) {
  const onChoose = vi.fn()
  const onKeep = vi.fn()
  const onDismiss = vi.fn()

  render(
    <AnimationPicker
      documentId={DOCUMENT}
      nodeId="a"
      anchor={document.body}
      laid={laid}
      onChoose={onChoose}
      onKeep={onKeep}
      onDismiss={onDismiss}
    />,
  )
  return { onChoose, onKeep, onDismiss }
}

beforeEach(() => {
  installFakeBridge({ animations: { list: () => Promise.resolve(bundled) } })
  useAssets.setState({ items: [] })
  useModelClips.setState({ clips: {}, rigs: {}, rigProgress: {}, lengths: {}, fits: {} })
  useScenes.setState({
    states: { [DOCUMENT]: { ...EMPTY_SCENE, nodes: [modelNodeFixture('a')] } },
    histories: {},
  })
  useSceneViews.setState({ views: {} })
})

describe('choosing an animation', () => {
  it('offers the three sources the issue names', () => {
    show()

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Bibliothèque',
      'Import',
      'IA',
    ])
  })

  it('lists what the app ships with, and hands its source back on a click', async () => {
    const { onChoose } = show()

    await userEvent.click(await screen.findByRole('button', { name: 'Capoeira' }))

    expect(onChoose).toHaveBeenCalledWith({ kind: 'bundled', name: 'Capoeira' }, 'Capoeira')
  })

  it('lists the motions the project holds beside them', async () => {
    useAssets.setState({
      items: [
        {
          id: 'asset-9',
          name: 'jig',
          type: 'animation',
          location: 'local',
          tags: [],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    const { onChoose } = show()

    await userEvent.click(await screen.findByRole('button', { name: 'jig' }))

    expect(onChoose).toHaveBeenCalledWith({ kind: 'asset', assetId: 'asset-9', name: 'jig' }, 'jig')
  })

  // Nothing is laid yet, so there is nothing to keep and nothing to look at.
  it('offers neither preview nor decision until something has been chosen', () => {
    show()

    expect(screen.queryByRole('button', { name: 'Garder' })).not.toBeInTheDocument()
  })

  it('offers the two ways out once a block is laid', () => {
    const { onKeep, onDismiss } = show({
      clipId: 'block-1',
      source: { kind: 'bundled', name: 'Capoeira' },
    })

    expect(screen.getByRole('button', { name: 'Garder' })).toBeInTheDocument()
    expect(onKeep).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
