import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { installDocument } from '@/stores/document-fixtures'
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

  // Every destination opens its own document before writing into it — which is the half of the
  // gesture "Use as sky" does not say, and the one that surprises.
  it('says that a destination opens its document, not only that it takes the asset', () => {
    render(<AssetMenu asset={asset()} at={AT} onClose={() => {}} />)

    expect(screen.getByRole('menuitem', { name: /ciel/ })).toHaveAttribute(
      'data-tooltip-content',
      'Ouvre l’espace Ciels et pose cette image comme source du panorama',
    )
    expect(screen.getByRole('menuitem', { name: /calque/ })).toHaveAttribute(
      'data-tooltip-content',
      'Ouvre le document image et pose l’asset en nouveau calque',
    )
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
    installDocument('seq-1', 'video')
    render(<AssetMenu asset={asset()} at={AT} onClose={onClose} />)

    await userEvent.click(screen.getByRole('menuitem', { name: /montage/ }))

    expect(onClose).toHaveBeenCalled()
  })

  // The row used to be offered live whatever was open, because `ready` counted tabs and never
  // looked at the asset — a click that closed the menu and did nothing at all.
  it('greys out a destination its space is open for but that cannot take THIS asset', () => {
    installDocument('img-1', 'image')

    const { rerender } = render(<AssetMenu asset={asset()} at={AT} onClose={() => {}} />)
    expect(screen.getByRole('menuitem', { name: /calque/ })).toBeEnabled()

    rerender(<AssetMenu asset={asset({ location: 'cloud' })} at={AT} onClose={() => {}} />)
    expect(screen.getByRole('menuitem', { name: /calque/ })).toBeDisabled()
  })

  // A destination with no document to write into has no landing to promise, and an always-live
  // row would offer one anyway. Open somewhere is enough — the row does not care which tab is
  // in front, since choosing it brings its document forward.
  it('greys out the montage when no sequence is open at all', () => {
    render(<AssetMenu asset={asset()} at={AT} onClose={() => {}} />)
    expect(screen.getByRole('menuitem', { name: /montage/ })).toBeDisabled()

    installDocument('seq-1', 'video')
    render(<AssetMenu asset={asset()} at={AT} onClose={() => {}} />)
    expect(screen.getAllByRole('menuitem', { name: /montage/ })[1]).toBeEnabled()
  })

  it('explains what revealing does rather than repeating the row', () => {
    render(<AssetMenu asset={asset()} at={AT} onClose={() => {}} />)

    const row = screen.getByRole('menuitem', { name: /gestionnaire de fichiers/ })
    expect(row).toHaveAttribute(
      'data-tooltip-content',
      'Ouvre le gestionnaire de fichiers sur l’asset sélectionné',
    )
    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
    expect(row).not.toHaveAttribute('aria-label')
  })

  it('closes on Escape without doing anything', async () => {
    const onClose = vi.fn()
    render(<AssetMenu asset={asset()} at={AT} onClose={onClose} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
