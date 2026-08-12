import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge, type BridgeOverrides } from '@/services/fake-bridge'
import { useProject } from '@/stores/project'
import { ProjectMenu } from './ProjectMenu'

const PATH = '/projects/summer'

const report = vi.fn(() => Promise.resolve())

/** Always with the journal wired: a failure this menu drops is the defect being guarded. */
const install = (overrides: BridgeOverrides = {}): void => {
  installFakeBridge({ ...overrides, diagnostics: { report } })
}

const open = (onClose = vi.fn()): void => {
  render(<ProjectMenu path={PATH} at={{ x: 10, y: 10 }} onClose={onClose} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  install()
})

describe('the menu of a recent project', () => {
  it('says what each row does rather than reading its label back', () => {
    open()

    expect(screen.getByRole('menuitem', { name: 'Révéler dans le dossier' })).toHaveAttribute(
      'data-tooltip-content',
      'Ouvre le gestionnaire de fichiers sur ce projet',
    )
    // The one row a reader could take for "delete this project". It has to say that it does not.
    expect(screen.getByRole('menuitem', { name: 'Retirer de la liste' })).toHaveAttribute(
      'data-tooltip-content',
      'Retire le projet de cette liste, sans toucher au dossier ni à ce qu’il contient',
    )
  })

  it('leaves the visible labels to answer for themselves', () => {
    open()

    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
    for (const row of screen.getAllByRole('menuitem')) {
      expect(row).not.toHaveAttribute('aria-label')
    }
  })

  // The shelf points at projects that are not open, so the folder is named outright — nothing
  // resolves it against the open project.
  it('shows the folder it names, and closes behind itself', async () => {
    const revealFolder = vi.fn(() => Promise.resolve(true))
    const onClose = vi.fn()
    install({ project: { revealFolder } })
    open(onClose)

    await userEvent.click(screen.getByRole('menuitem', { name: 'Révéler dans le dossier' }))

    expect(revealFolder).toHaveBeenCalledWith(PATH)
    expect(onClose).toHaveBeenCalled()
  })

  it('drops the project from the shelf and closes behind itself', async () => {
    const forget = vi.fn(() => Promise.resolve())
    const onClose = vi.fn()
    useProject.setState({ forget })
    open(onClose)

    await userEvent.click(screen.getByRole('menuitem', { name: 'Retirer de la liste' }))

    expect(forget).toHaveBeenCalledWith(PATH)
    expect(onClose).toHaveBeenCalled()
  })

  /**
   * The menu is gone by the time either answer comes back, so a failure that stays in the
   * promise stays nowhere. Both can genuinely fail — the main process refuses a path that is not
   * absolute, and the settings write can be refused by the disk — and a row that does nothing
   * twice in silence reads as a dead menu.
   */
  describe('when the studio could not do what the row says', () => {
    it('says so when the folder is not there to show', async () => {
      install({ project: { revealFolder: () => Promise.resolve(false) } })
      open()

      await userEvent.click(screen.getByRole('menuitem', { name: 'Révéler dans le dossier' }))

      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', scope: 'project.reveal' }),
      )
    })

    it('says so when showing the folder is refused outright', async () => {
      install({
        project: { revealFolder: () => Promise.reject(new Error('not an absolute path')) },
      })
      open()

      await userEvent.click(screen.getByRole('menuitem', { name: 'Révéler dans le dossier' }))

      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', scope: 'project.reveal' }),
      )
    })

    it('says so when the shelf could not be written', async () => {
      useProject.setState({ forget: () => Promise.reject(new Error('read-only settings')) })
      open()

      await userEvent.click(screen.getByRole('menuitem', { name: 'Retirer de la liste' }))

      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', scope: 'project.forget' }),
      )
    })
  })

  // What the row promises in words, held in code: the studio does not erase a folder someone made.
  it('offers nothing that reaches the folder itself', async () => {
    const trashFile = vi.fn(() => Promise.resolve(true))
    useProject.setState({ forget: () => Promise.resolve() })
    install({ project: { trashFile } })
    open()

    for (const row of screen.getAllByRole('menuitem')) await userEvent.click(row)

    expect(trashFile).not.toHaveBeenCalled()
  })
})
