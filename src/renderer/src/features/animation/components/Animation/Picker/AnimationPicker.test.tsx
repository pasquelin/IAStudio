import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ASSET_SEARCH_LIMIT_MAX, type Asset } from '@shared/domain/asset'
import type { ClipSource } from '@shared/domain/scene'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from '@/stores/assets'
import { useModelFiles } from '@/stores/modelFiles'
import { useScenes } from '@/stores/scenes'
import { useSceneViews } from '@/stores/sceneViews'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { modelNodeFixture } from '@/engines/scene/scene-fixtures'
import { AnimationPicker } from './AnimationPicker'

const DOCUMENT = 'doc-1'

const bundled = [{ name: 'Capoeira', thumbnail: true }]

const JIG: Asset = {
  id: 'asset-9',
  name: 'jig',
  type: 'animation',
  location: 'local',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
}

function show(laid: { clipId: string; source: ClipSource } | null = null) {
  const onChoose = vi.fn()
  const onKeep = vi.fn()
  const onCancel = vi.fn()

  render(
    <AnimationPicker
      documentId={DOCUMENT}
      nodeId="a"
      anchor={document.body}
      laid={laid}
      onChoose={onChoose}
      onKeep={onKeep}
      onCancel={onCancel}
    />,
  )
  return { onChoose, onKeep, onCancel }
}

beforeEach(() => {
  installFakeBridge({ animations: { list: () => Promise.resolve(bundled) } })
  useAssets.setState({ items: [] })
  useModelFiles.setState({ clips: {}, rigs: {}, lengths: {}, fits: {} })
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

  // The character's own clips are offered here too, and a Tripo rig spells its one `NlaTrack`.
  it('offers a clip of the character under a name of the app, not the exporter’s', async () => {
    useModelFiles.setState({ clips: { [DOCUMENT]: { a: ['NlaTrack'] } } })
    const { onChoose } = show()

    await userEvent.click(await screen.findByRole('button', { name: 'Animation' }))

    // The row READS « Animation » and the document keeps « NlaTrack »: a translated word written
    // into a glTF would follow the language the project happened to be created in.
    expect(onChoose).toHaveBeenCalledWith({ kind: 'embedded', name: 'NlaTrack' }, 'NlaTrack')
  })

  it('lists what the app ships with, and hands its source back on a click', async () => {
    const { onChoose } = show()

    await userEvent.click(await screen.findByRole('button', { name: 'Capoeira' }))

    expect(onChoose).toHaveBeenCalledWith({ kind: 'bundled', name: 'Capoeira' }, 'Capoeira')
  })

  // The shelf stays empty on purpose: `useAssets.items` is a SCOPE — paged, narrowed by the space
  // in front and by whatever facet was picked — so a library built out of it lists what has been
  // browsed rather than what the project holds.
  it('lists the motions the project holds beside them', async () => {
    installFakeBridge({
      animations: { list: () => Promise.resolve(bundled) },
      assets: { search: () => Promise.resolve([JIG]) },
    })
    const { onChoose } = show()

    await userEvent.click(await screen.findByRole('button', { name: 'jig' }))

    expect(onChoose).toHaveBeenCalledWith({ kind: 'asset', assetId: 'asset-9', name: 'jig' }, 'jig')
  })

  it('offers none the catalogue no longer holds, whatever the shelf still remembers', async () => {
    useAssets.setState({ items: [JIG] })
    show()

    expect(await screen.findByRole('button', { name: 'Capoeira' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'jig' })).not.toBeInTheDocument()
  })

  // Without a `limit` the main answers `DEFAULT_LIMIT` — 200, exactly the page the shelf reads by,
  // so a project past that many motions would be truncated with nothing said.
  it('asks the catalogue as wide as it is allowed to answer', async () => {
    const search = vi.fn(() => Promise.resolve([JIG]))
    installFakeBridge({
      animations: { list: () => Promise.resolve(bundled) },
      assets: { search },
    })
    show()

    await screen.findByRole('button', { name: 'jig' })

    expect(search).toHaveBeenCalledWith({ type: 'animation', limit: ASSET_SEARCH_LIMIT_MAX })
  })

  // Nothing is laid yet, so there is nothing to keep and nothing to look at.
  it('offers neither preview nor decision until something has been chosen', () => {
    show()

    expect(screen.queryByRole('button', { name: 'Garder' })).not.toBeInTheDocument()
  })

  it('offers the two ways out once a block is laid', () => {
    const { onKeep, onCancel } = show({
      clipId: 'block-1',
      source: { kind: 'bundled', name: 'Capoeira' },
    })

    expect(screen.getByRole('button', { name: 'Garder' })).toBeInTheDocument()
    expect(onKeep).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('takes the block back on the only control that means it', async () => {
    const { onKeep, onCancel } = show({
      clipId: 'block-1',
      source: { kind: 'bundled', name: 'Capoeira' },
    })

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onKeep).not.toHaveBeenCalled()
  })
})
