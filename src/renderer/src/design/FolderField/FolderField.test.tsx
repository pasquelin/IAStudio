import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FolderEntry } from '@shared/domain/folder'
import { installFakeBridge } from '@/services/fakeBridge'
import { useProject } from '@/stores/project'
import { FolderField } from './FolderField'

const LABELS = {
  crumbs: 'Dossier ouvert',
  crumbHint: 'Revenir à ce dossier',
  hint: 'Choisit le dossier',
  enterHint: 'Ouvrir ce dossier',
  empty: 'Ce dossier ne contient aucun sous-dossier.',
  newFolderIn: 'Nouveau dossier dans Images',
  newFolderName: 'Nouveau dossier',
  newFolderLabel: 'Nom du dossier',
  create: 'Créer',
  cancel: 'Annuler',
  folderTaken: 'Ce dossier contient déjà un dossier de ce nom.',
  folderFailed: 'Ce dossier n’a pas pu être créé.',
}

const FOLDERS: Record<string, readonly FolderEntry[]> = {
  '': [
    { path: 'Images', name: 'Images', kind: 'folder' },
    { path: 'lisezmoi.txt', name: 'lisezmoi.txt', kind: 'file' },
    // A layered image is written AS a folder, and the listing answers it as one.
    { path: 'TOTO.img', name: 'TOTO.img', kind: 'folder' },
  ],
  Images: [{ path: 'Images/Croquis', name: 'Croquis', kind: 'folder' }],
  'Images/Croquis': [],
}

const listFolder = (folder: string): Promise<FolderEntry[]> =>
  Promise.resolve([...(FOLDERS[folder] ?? [])])

const show = (value = '', onChange = vi.fn()): { onChange: ReturnType<typeof vi.fn> } => {
  render(<FolderField value={value} onChange={onChange} rootName="Project1" labels={LABELS} />)
  return { onChange }
}

const open = async (): Promise<void> => {
  await userEvent.click(screen.getAllByRole('button')[0] as HTMLElement)
}

describe('FolderField', () => {
  beforeEach(() => {
    installFakeBridge({ project: { listFolder } })
    const stamp = '2026-08-16T10:00:00.000Z'
    useProject.setState({
      project: {
        path: '/projects/one',
        manifest: { version: 1, name: 'Project1', createdAt: stamp, updatedAt: stamp },
      },
    })
  })

  // The walk, not the bare path: a folder is read as where it SITS, and the project itself is
  // the first step of it.
  it('reads the chosen folder as the walk down to it', () => {
    show('Images/Croquis')
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Project1 / Images / Croquis')
  })

  it('shows what the folder holds, one level and no deeper', async () => {
    show()
    await open()

    expect(await screen.findByRole('menuitem', { name: 'Images' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Croquis' })).not.toBeInTheDocument()
  })

  it('offers no file among the folders', async () => {
    show()
    await open()

    await screen.findByRole('menuitem', { name: 'Images' })
    expect(screen.queryByRole('menuitem', { name: /lisezmoi/ })).not.toBeInTheDocument()
  })

  /**
   * A document is not a place, even where it IS a folder on disk: an image writes itself as
   * `TOTO.img/`, and filing a document inside another document is what this keeps from being
   * offered at all.
   */
  it('offers no document, though one may be a folder', async () => {
    show()
    await open()

    await screen.findByRole('menuitem', { name: 'Images' })
    expect(screen.queryByRole('menuitem', { name: /TOTO/ })).not.toBeInTheDocument()
  })

  // Walking into a folder IS choosing it — the whole point of showing one at a time.
  it('answers with the folder that was walked into', async () => {
    const { onChange } = show()
    await open()

    await userEvent.click(await screen.findByRole('menuitem', { name: 'Images' }))

    expect(onChange).toHaveBeenCalledWith('Images')
  })

  it('walks back up through the crumbs', async () => {
    const { onChange } = show('Images/Croquis')
    await open()

    await userEvent.click(await screen.findByRole('button', { name: 'Images' }))

    expect(onChange).toHaveBeenCalledWith('Images')
  })

  // Said rather than left blank: an empty list and a list still loading look alike, and a menu
  // showing nothing at all reads as broken.
  it('says a folder holds no sub-folder', async () => {
    show('Images/Croquis')
    await open()

    expect(await screen.findByText(LABELS.empty)).toBeInTheDocument()
  })

  /**
   * The parent is NAMED. The first version put a bare input at the foot of a tree, and nothing
   * on screen said which folder it would land in — which is what made the field unreadable.
   */
  it('names the folder a new one would be made in', async () => {
    show('Images')
    await open()

    expect(await screen.findByRole('menuitem', { name: LABELS.newFolderIn })).toBeInTheDocument()
  })

  it('makes a folder where the field is pointing, and moves into it', async () => {
    const newFolder = vi.fn(() =>
      Promise.resolve({ done: [{ from: '', to: 'Images/Neuf' }], refused: [], batch: 'b' }),
    )
    installFakeBridge({ project: { listFolder, newFolder } })
    const { onChange } = show('Images')
    await open()

    await userEvent.click(await screen.findByRole('menuitem', { name: LABELS.newFolderIn }))
    await userEvent.clear(screen.getByRole('textbox', { name: 'Nom du dossier' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Nom du dossier' }), 'Neuf')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))

    expect(newFolder).toHaveBeenCalledWith('Images', 'Neuf')
    expect(onChange).toHaveBeenCalledWith('Images/Neuf')
  })

  it('gives up on the folder without making one', async () => {
    const newFolder = vi.fn(() => Promise.resolve({ done: [], refused: [], batch: 'b' }))
    installFakeBridge({ project: { listFolder, newFolder } })
    show('Images')
    await open()

    await userEvent.click(await screen.findByRole('menuitem', { name: LABELS.newFolderIn }))
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(newFolder).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: 'Nom du dossier' })).not.toBeInTheDocument()
  })

  // Said where it was asked for rather than swallowed: a name the folder already holds is the
  // ordinary refusal, and a gesture that runs its course and does nothing is the worst outcome.
  it('says why a folder was refused, and keeps the field open', async () => {
    installFakeBridge({
      project: {
        listFolder,
        newFolder: () =>
          Promise.resolve({ done: [], refused: [{ path: 'Neuf', reason: 'exists' }], batch: 'b' }),
      },
    })
    show('Images')
    await open()

    await userEvent.click(await screen.findByRole('menuitem', { name: LABELS.newFolderIn }))
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(LABELS.folderTaken)
    expect(screen.getByRole('textbox', { name: 'Nom du dossier' })).toBeInTheDocument()
  })
})
