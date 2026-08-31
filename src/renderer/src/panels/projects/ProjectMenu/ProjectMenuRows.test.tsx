import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileOutcome } from '@shared/domain/fileOp'
import { ContextMenu } from '@/design/ContextMenu'
import { installFakeBridge, type BridgeOverrides } from '@/services/fakeBridge'
import { useProject, type ProjectRenamed } from '@/stores/project'
import { ProjectMenuRows } from './ProjectMenuRows'

/** What a rename answers back — the row's own path and name are what the cases assert on. */
const RENAMED_OK: ProjectRenamed = {
  ok: true,
  project: {
    path: '/tmp/Renamed',
    manifest: {
      version: 1,
      name: 'Renamed',
      createdAt: '2026-08-17T10:00:00.000Z',
      updatedAt: '2026-08-17T10:00:00.000Z',
    },
  },
}

const PATH = '/projects/summer'

const report = vi.fn(() => Promise.resolve())

const nothingMoved = (): Promise<FileOutcome> =>
  Promise.resolve({ done: [], refused: [], batch: 'batch-1' })

/** Always with the journal wired: a failure this menu drops is the defect being guarded. */
const install = (overrides: BridgeOverrides = {}): void => {
  installFakeBridge({ ...overrides, diagnostics: { report } })
}

/** At the pointer, as the shelf's row raises them. */
const open = (onClose = vi.fn(), onRename?: () => void): void => {
  render(
    <ContextMenu at={{ x: 10, y: 10 }} onClose={onClose}>
      <ProjectMenuRows path={PATH} onClose={onClose} onRename={onRename} />
    </ContextMenu>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  install()
})

describe('the menu of a recent project', () => {
  it('says what each row does rather than reading its label back', () => {
    open()

    expect(screen.getByRole('menuitem', { name: 'Afficher dans le dossier' })).toHaveAttribute(
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

    await userEvent.click(screen.getByRole('menuitem', { name: 'Afficher dans le dossier' }))

    expect(revealFolder).toHaveBeenCalledWith(PATH)
    expect(onClose).toHaveBeenCalled()
  })

  /**
   * The rename opens a FIELD rather than reaching the disk: the row owns it, as the explorer's
   * does. So the menu's whole job here is to hand the gesture back and get out of the way.
   */
  it('hands the rename back to the row, and closes behind itself', async () => {
    const onRename = vi.fn()
    const onClose = vi.fn()
    open(onClose, onRename)

    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))

    expect(onRename).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  // Refused rather than silently doing nothing where no field can open — a row that explains
  // nothing and does nothing is the worst of the outcomes this menu can produce.
  it('refuses the rename where no field can open', () => {
    open()

    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toBeDisabled()
  })

  /**
   * The row a reader is most likely to take for "rename the folder on disk". It has to say that it
   * does not: `recentProjects`, `storage.lastProject` and every absolute path the catalogue holds
   * are keyed on that folder.
   */
  it('says the rename leaves the folder alone', () => {
    open(vi.fn(), vi.fn())

    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toHaveAttribute(
      'data-tooltip-content',
      'Changer le nom du projet, sans toucher à son dossier sur le disque',
    )
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

      await userEvent.click(screen.getByRole('menuitem', { name: 'Afficher dans le dossier' }))

      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', scope: 'project.reveal' }),
      )
    })

    it('says so when showing the folder is refused outright', async () => {
      install({
        project: { revealFolder: () => Promise.reject(new Error('not an absolute path')) },
      })
      open()

      await userEvent.click(screen.getByRole('menuitem', { name: 'Afficher dans le dossier' }))

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
    const trashFiles = vi.fn(nothingMoved)
    const rename = vi.fn(() => Promise.resolve(RENAMED_OK))
    useProject.setState({ forget: () => Promise.resolve(), rename })
    install({ project: { trashFiles } })
    // Every row enabled, so the sweep below actually presses all three rather than bouncing off
    // a disabled one and reporting that nothing reached the disk.
    open(vi.fn(), vi.fn())

    for (const row of screen.getAllByRole('menuitem')) await userEvent.click(row)

    expect(trashFiles).not.toHaveBeenCalled()
    // The rename reaches the manifest and never the folder: it opens a field here, and even the
    // store's own call renames in place.
    expect(rename).not.toHaveBeenCalled()
  })
})
