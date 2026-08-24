import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AssetChanges, AssetQuery } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { FileInspector } from './FileInspector'

const ruelle: Asset = {
  id: 'asset_1',
  name: 'Ruelle bleue',
  type: 'image',
  location: 'local',
  path: 'Repérages/ruelle.png',
  tags: [],
  createdAt: '2026-08-17T10:00:00.000Z',
  bytes: 2048,
}

/** The catalogue answers the paths it was asked about, and nothing else. */
function install(catalogued: readonly Asset[] = []) {
  const search = vi.fn((query: AssetQuery) =>
    Promise.resolve(catalogued.filter(asset => query.paths?.includes(asset.path ?? ''))),
  )
  const update = vi.fn((_assetId: string, changes: AssetChanges) =>
    Promise.resolve({ ...ruelle, ...changes, tags: [...(changes.tags ?? ruelle.tags)] }),
  )
  installFakeBridge({ assets: { search, update } })
  return { search, update }
}

beforeEach(() => {
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  useAssets.setState({ items: [] })
})

describe('a file of the project, read out', () => {
  it('names what it is from the extension when nothing holds a row for it', async () => {
    install()

    render(<FileInspector paths={['Repérages/notes.pdf']} />)

    expect(await screen.findByText('notes.pdf')).toBeInTheDocument()
    expect(screen.getByText('Repérages/notes.pdf')).toBeInTheDocument()
    // Read out, never offered: there is nowhere to write a correction down.
    expect(screen.getByText('Autre')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Rôle' })).toBeNull()
  })

  /**
   * An extension cannot always tell — a normal map and an albedo are both PNGs — so the guess is
   * offered rather than imposed, wherever the studio has a row to remember the answer in.
   */
  it('corrects the role of a file the catalogue holds', async () => {
    const { update } = install([ruelle])

    render(<FileInspector paths={['Repérages/ruelle.png']} />)

    const role = await screen.findByRole('combobox', { name: 'Rôle' })
    await userEvent.selectOptions(role, 'texture')

    await waitFor(() => expect(update).toHaveBeenCalledWith('asset_1', { type: 'texture' }))
  })

  it('asks the catalogue once for a whole selection', async () => {
    const { search } = install([ruelle])

    render(<FileInspector paths={['Repérages/ruelle.png', 'Repérages/notes.pdf']} />)

    await waitFor(() => expect(search).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('2')).toBeInTheDocument()
    // Twelve files summarised rather than detailed: correcting the first one's role for a
    // selection of twelve is how someone corrects the wrong file.
    expect(screen.queryByRole('combobox', { name: 'Rôle' })).toBeNull()
  })
})
