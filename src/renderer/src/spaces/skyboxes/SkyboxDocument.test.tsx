import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { startAssetDrag } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { useAssets } from '@/stores/assets'
import { installDocument } from '@/stores/document-fixtures'
import { skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { SkyboxDocument } from './SkyboxDocument'

// jsdom has no WebGL context: what the engine draws is exercised by hand, not here. This
// covers the document handing it the right state — same reason as `SceneDocument.test`.
vi.mock('@/engines/skybox/SkyboxRenderer', () => ({
  SkyboxRenderer: class {
    mount = vi.fn()
    apply = vi.fn()
    dispose = vi.fn()
    setFieldOfView = vi.fn()
    setProbesVisible = vi.fn()
  },
}))

const panorama: Asset = {
  id: 'asset-dusk',
  name: 'dusk',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
}

function dragging(assetId: string): DataTransfer {
  const dataTransfer = dragTransfer()
  startAssetDrag({ dataTransfer }, { id: assetId, type: 'image' })
  return dataTransfer
}

const sourceOf = (documentId: string): { assetId: string } | null =>
  skyboxOf(useSkyboxes.getState(), documentId).source

/** The element the drop lands on: the engine's host fills it and swallows nothing. */
function viewport(): Element {
  const { container } = render(<SkyboxDocument documentId="doc-1" />)
  const root = container.firstElementChild
  if (!root) throw new Error('the skybox document renders nothing')
  return root
}

describe('SkyboxDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSkyboxes.setState({ states: {}, histories: {} })
    useAssets.setState({ items: [panorama] })
    installDocument('doc-1', 'skyboxes')
  })

  it('hangs a picture dropped from the shelf', () => {
    fireEvent.drop(viewport(), { dataTransfer: dragging('asset-dusk') })
    expect(sourceOf('doc-1')).toEqual({ assetId: 'asset-dusk' })
  })

  // The drag carries an id, never the asset: one the catalogue no longer holds has no file
  // behind it, and the engine would load a 404 into a sky it cannot tell from a black one.
  it('ignores an id the catalogue does not hold', () => {
    fireEvent.drop(viewport(), { dataTransfer: dragging('asset-gone') })
    expect(sourceOf('doc-1')).toBeNull()
  })

  it('leaves a file dragged in from the desktop alone', () => {
    const dataTransfer = dragTransfer()
    dataTransfer.setData('text/plain', 'asset-dusk')

    fireEvent.drop(viewport(), { dataTransfer })

    expect(sourceOf('doc-1')).toBeNull()
  })

  /**
   * A canvas React owns is reused across StrictMode's mount / unmount / mount, and the first
   * engine's `dispose` purges the one WebGL context the second draws into. Same rule as the
   * scene editor: the engine makes its own canvas inside a plain host.
   */
  it('hands the renderer a host to fill, never a canvas of its own', () => {
    const { container } = render(<SkyboxDocument documentId="doc-1" />)
    expect(container.querySelector('canvas')).toBeNull()
  })
})
