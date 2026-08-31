import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { STUDIO_ENVIRONMENT, type EnvironmentRef } from '@shared/domain/scene'
import { installFakeBridge } from '@/services/fakeBridge'
import { installDocuments } from '@/stores/document-fixtures'
import { EnvironmentChoice } from './EnvironmentChoice'

const PICTURE: Asset = {
  id: 'asset-1',
  name: 'coucher',
  path: 'Ciels/coucher.hdr',
  type: 'skybox',
  location: 'local',
  tags: [],
  createdAt: '2026-08-26T10:00:00.000Z',
}

describe('what lights a viewport', () => {
  let changed: ReturnType<typeof vi.fn<(environment: EnvironmentRef) => void>>

  beforeEach(() => {
    changed = vi.fn<(environment: EnvironmentRef) => void>()
    installFakeBridge({ assets: { search: () => Promise.resolve([PICTURE]) } })
    installDocuments({ 'sky-1': 'skyboxes', 'doc-1': '3d' }, 'doc-1')
  })

  const show = (environment: EnvironmentRef = STUDIO_ENVIRONMENT) =>
    render(<EnvironmentChoice environment={environment} onChange={changed} />)

  const source = () => screen.getByRole('combobox', { name: 'Source' })

  it('offers the three ways a viewport is lit', () => {
    show()

    expect([...source().querySelectorAll('option')].map(one => one.textContent)).toEqual([
      'Studio',
      'Une image',
      'Un ciel',
    ])
  })

  // A reference and not a copy: this is the whole point of the row — editing that sky edits the scene.
  it('follows the first sky DOCUMENT of the project when a sky is asked for', async () => {
    show()

    await userEvent.selectOptions(source(), 'sky')

    expect(changed).toHaveBeenCalledWith({ kind: 'sky', documentId: 'sky-1' })
  })

  it('offers the sky DOCUMENTS under a sky, never the project pictures', async () => {
    show({ kind: 'sky', documentId: 'sky-1' })

    const link = screen.getByRole('combobox', { name: 'Ciel' })
    expect(link).toHaveValue('sky-1')
    // The picture is in the project and it is NOT on offer here: what a scene follows is a
    // document, and a picture in this list would be a reference to something that has no sun.
    await screen.findByRole('option', { name: 'sky-1' })
    expect(screen.queryByRole('option', { name: 'coucher' })).toBeNull()
  })

  /**
   * Shown under the studio too: this slot is the one drop target a viewport has for a sky, and a
   * fresh document opens on the studio — hiding it there left no way at all to drag one in.
   */
  it('keeps the picture slot under the studio', () => {
    show()

    expect(screen.getByRole('combobox', { name: 'Ciel' })).toBeInTheDocument()
  })

  it('hands the view back to the studio when the sky link is emptied', async () => {
    show({ kind: 'sky', documentId: 'sky-1' })

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ciel' }), '')

    expect(changed).toHaveBeenCalledWith(STUDIO_ENVIRONMENT)
  })
})
