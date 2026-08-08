import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { AssetMenu } from './AssetMenu'

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    name: 'Boulder',
    type: 'image',
    location: 'local',
    path: 'assets/img/asset_1.png',
    tags: [],
    createdAt: '2026-08-06T10:00:00.000Z',
    ...overrides,
  }
}

const AT = { x: 10, y: 10 }

describe('what the shelf offers to do with an asset', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    installFakeBridge()
  })

  it('lists every destination that takes this kind', () => {
    render(<AssetMenu asset={asset()} at={AT} onClose={() => {}} />)

    expect(screen.getByRole('menuitem', { name: /ciel/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /calque/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /montage/ })).toBeInTheDocument()
  })

  it('offers a take nothing a picture would take', () => {
    render(<AssetMenu asset={asset({ type: 'audio' })} at={AT} onClose={() => {}} />)

    expect(screen.queryByRole('menuitem', { name: /ciel/ })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /audio/ })).toBeInTheDocument()
  })

  // A menu that changes length depending on what is open is a menu one cannot learn.
  it('shows a destination with nowhere to put it, but greyed out', () => {
    render(<AssetMenu asset={asset()} at={AT} onClose={() => {}} />)

    expect(screen.getByRole('menuitem', { name: /ciel/ })).toBeDisabled()
  })

  it('cannot show a cloud asset in the file manager, since there is no file yet', () => {
    render(<AssetMenu asset={asset({ location: 'cloud' })} at={AT} onClose={() => {}} />)

    expect(screen.getByRole('menuitem', { name: /gestionnaire de fichiers/ })).toBeDisabled()
  })

  it('closes once something has been chosen', async () => {
    const onClose = vi.fn()
    render(<AssetMenu asset={asset()} at={AT} onClose={onClose} />)

    await userEvent.click(screen.getByRole('menuitem', { name: /montage/ }))

    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape without doing anything', async () => {
    const onClose = vi.fn()
    render(<AssetMenu asset={asset()} at={AT} onClose={onClose} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
