import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { editPixelsOf } from '@/helpers/openAsset'
import { installFakeBridge } from '@/services/fakeBridge'
import { installSkybox } from '@/stores/skybox-fixtures'
import { setSkyboxSource, skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { SkyboxInspectorSource } from './SkyboxInspectorSource'

/** Behind it sit the six editors, which is why this row reaches it and nothing here loads one. */
vi.mock('@/helpers/openAsset', () => ({ editPixelsOf: vi.fn(), openAssetById: vi.fn() }))

const PANORAMA: Asset = {
  id: 'sky-1',
  name: 'Coucher',
  type: 'skybox',
  location: 'local',
  path: 'assets/sky-1.png',
  tags: [],
  createdAt: '2026-08-25T00:00:00.000Z',
}

const show = async (): Promise<void> => {
  render(<SkyboxInspectorSource documentId="doc-1" />)
  await screen.findAllByRole('option', { name: 'Coucher' })
}

beforeEach(() => {
  installSkybox('doc-1')
  installFakeBridge({ assets: { search: () => Promise.resolve([PANORAMA]) } })
  vi.mocked(editPixelsOf).mockReset()
})

describe('the panorama a sky is made of', () => {
  /**
   * The line the space never had: a sky writes no image back, so before this its picture could be
   * generated, graded and lit — and never repainted from anywhere but the shelf's context menu.
   */
  it('opens the panorama where its pixels are painted, on a double-click', async () => {
    const paint = vi.fn()
    vi.mocked(editPixelsOf).mockReturnValue({ workspace: 'image', run: paint })
    setSkyboxSource('doc-1', PANORAMA)
    await show()

    await userEvent.dblClick(screen.getByRole('button', { name: 'Choisir une image' }))

    expect(editPixelsOf).toHaveBeenCalledWith(expect.objectContaining({ id: 'sky-1' }))
    expect(paint).toHaveBeenCalled()
  })

  /**
   * Nothing to paint, nothing to open — and not the generic fallback either, which would send the
   * panorama to a SECOND skybox document from inside the skybox inspector. The press stays: it
   * chooses, which a slot can always do.
   */
  it('opens nothing on a double-click where there is nothing on disk to paint', async () => {
    const paint = vi.fn()
    vi.mocked(editPixelsOf).mockReturnValue(null)
    setSkyboxSource('doc-1', PANORAMA)
    await show()

    await userEvent.dblClick(screen.getByRole('button', { name: 'Choisir une image' }))

    expect(paint).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Ouvrir la texture' })).toBeNull()
  })

  /**
   * A fresh sky holds no source, and a `<select>` given a value none of its options carries shows
   * the FIRST one — so the row read as the project's first picture over a blank thumbnail.
   */
  it('reads as empty on a sky nothing has filled yet', async () => {
    await show()

    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  /** Its space draws an empty state, so the row has to be able to reach one. */
  it('takes the panorama back off', async () => {
    setSkyboxSource('doc-1', PANORAMA)
    await show()

    await userEvent.click(screen.getByRole('button', { name: 'Retirer l’image' }))

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source).toBeNull()
  })

  /** The store reads the provenance off the asset, so an id alone cannot be what lands here. */
  it('replaces the panorama from the project’s own pictures', async () => {
    await show()

    await userEvent.selectOptions(screen.getByRole('combobox'), 'sky-1')

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source?.assetId).toBe('sky-1')
  })
})
