import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '@shared/domain/update'
import { STATUS_BUTTON } from '@/design/styles'
import { installFakeBridge } from '@/services/fake-bridge'
import { useUpdates } from '@/stores/updates'
import { UpdateStatus } from './UpdateStatus'

function show(update: UpdateState) {
  useUpdates.setState({ update })
  return render(<UpdateStatus />)
}

beforeEach(() => {
  installFakeBridge()
  useUpdates.setState({ update: { phase: 'idle' } })
})

describe('the update indicator', () => {
  it('says nothing while the version in use is the current one', () => {
    const { container } = show({ phase: 'idle' })
    expect(container).toBeEmptyDOMElement()
  })

  // Checking is the normal state at every launch; announcing it would be noise.
  it('says nothing while checking', () => {
    const { container } = show({ phase: 'checking' })
    expect(container).toBeEmptyDOMElement()
  })

  // Not knowing whether a newer version exists is not a problem the user has to be told about.
  it('says nothing when the check failed', () => {
    const { container } = show({ phase: 'failed' })
    expect(container).toBeEmptyDOMElement()
  })

  it('names the version it found', () => {
    show({ phase: 'available', version: '0.2.0' })
    expect(screen.getByText('Version 0.2.0 disponible')).toBeInTheDocument()
  })

  it('shows how far the download has got', () => {
    show({ phase: 'downloading', version: '0.2.0', progress: 0.4 })

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
  })

  it('installs when the restart is asked for', async () => {
    const install = vi.fn(() => Promise.resolve())
    installFakeBridge({
      updates: { state: () => Promise.resolve({ phase: 'ready', version: '0.2.0' }), install },
    })
    show({ phase: 'ready', version: '0.2.0' })

    await userEvent.click(screen.getByRole('button', { name: /0\.2\.0/ }))

    expect(install).toHaveBeenCalled()
  })

  it('offers the target the status line shares', () => {
    show({ phase: 'ready', version: '0.2.0' })

    expect(screen.getByRole('button')).toHaveClass(STATUS_BUTTON)
  })

  /**
   * The face reads "Redémarrer pour 0.2.0" — a version, and nothing about the download already
   * being on disk. Pressing it restarts the studio, which is not a thing to discover afterwards.
   */
  it('says the restart installs something already downloaded', () => {
    show({ phase: 'ready', version: '0.2.0' })

    expect(screen.getByRole('button')).toHaveAttribute(
      'data-tooltip-content',
      'Redémarre le studio pour installer la version déjà téléchargée',
    )
  })

  // Nothing to restart into until the bytes are on disk: the announcement is not a button.
  it('offers no restart while the download is still running', () => {
    show({ phase: 'downloading', version: '0.2.0', progress: 0.4 })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
