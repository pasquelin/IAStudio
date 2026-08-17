import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FolderEntry } from '@shared/domain/folder'
import { installFakeBridge } from '@/services/fakeBridge'
import { useProject } from '@/stores/project'
import { FolderField } from './FolderField'

const LABELS = {
  tree: 'Dossiers du projet',
  hint: 'Choisit le dossier',
  newFolder: 'Nouveau dossier…',
  newFolderName: 'Nouveau dossier',
  newFolderLabel: 'Nom du dossier',
  folderTaken: 'Ce dossier contient déjà un dossier de ce nom.',
  folderFailed: 'Ce dossier n’a pas pu être créé.',
}

const FOLDERS: Record<string, readonly FolderEntry[]> = {
  '': [
    { path: 'Images', name: 'Images', kind: 'folder' },
    { path: 'lisezmoi.txt', name: 'lisezmoi.txt', kind: 'file' },
    // A layered image is written AS a folder, and the tree answers it as one.
    { path: 'TOTO.img', name: 'TOTO.img', kind: 'folder' },
  ],
  Images: [{ path: 'Images/Croquis', name: 'Croquis', kind: 'folder' }],
}

const holding = (over: Partial<Parameters<typeof installFakeBridge>[0]> = {}) =>
  installFakeBridge({
    project: { listFolder: folder => Promise.resolve([...(FOLDERS[folder] ?? [])]) },
    ...over,
  })

const show = (value = '', onChange = vi.fn()): { onChange: ReturnType<typeof vi.fn> } => {
  render(<FolderField value={value} onChange={onChange} rootName="Project1" labels={LABELS} />)
  return { onChange }
}

const openTree = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button'))
}

describe('FolderField', () => {
  beforeEach(() => {
    holding()
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
    expect(screen.getByRole('button')).toHaveTextContent('Project1 / Images / Croquis')
  })

  it('names the project folder itself for a document going to the root', () => {
    show('')
    expect(screen.getByRole('button')).toHaveTextContent('Project1')
  })

  it('offers the project folders, and no file among them', async () => {
    show()
    await openTree()

    expect(await screen.findByRole('treeitem', { name: /Images/ })).toBeInTheDocument()
    expect(screen.queryByRole('treeitem', { name: /lisezmoi/ })).not.toBeInTheDocument()
  })

  /**
   * A document is not a place, even where it IS a folder on disk: an image writes itself as
   * `TOTO.img/`, and filing a document inside another document is what this keeps from being
   * offered at all.
   */
  it('offers no document, though one may be a folder', async () => {
    show()
    await openTree()

    expect(await screen.findByRole('treeitem', { name: /Images/ })).toBeInTheDocument()
    expect(screen.queryByRole('treeitem', { name: /TOTO/ })).not.toBeInTheDocument()
  })

  it('answers with the folder that was picked', async () => {
    const { onChange } = show()
    await openTree()

    await userEvent.click(await screen.findByRole('treeitem', { name: /Images/ }))

    expect(onChange).toHaveBeenCalledWith('Images')
  })

  // A field opening on a folder deep in the tree has to SHOW that folder: unfolding the walk is
  // what puts the row on screen, and `toggle` would have closed the very row it revealed.
  it('unfolds the walk down to the chosen folder', async () => {
    show('Images/Croquis')
    await openTree()

    expect(await screen.findByRole('treeitem', { name: /Croquis/ })).toBeInTheDocument()
  })

  it('makes a folder where the field is pointing, and moves into it', async () => {
    const newFolder = vi.fn(() =>
      Promise.resolve({ done: [{ from: '', to: 'Images/Neuf' }], refused: [], batch: 'b' }),
    )
    holding({ project: { listFolder: f => Promise.resolve([...(FOLDERS[f] ?? [])]), newFolder } })
    const { onChange } = show('Images')
    await openTree()

    await userEvent.click(screen.getByRole('menuitem', { name: 'Nouveau dossier…' }))
    await userEvent.clear(screen.getByRole('textbox', { name: 'Nom du dossier' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Nom du dossier' }), 'Neuf{Enter}')

    expect(newFolder).toHaveBeenCalledWith('Images', 'Neuf')
    expect(onChange).toHaveBeenCalledWith('Images/Neuf')
  })

  // Said where it was asked for rather than swallowed: a name the folder already holds is the
  // ordinary refusal, and a gesture that runs its course and does nothing is the worst outcome.
  it('says why a folder was refused, and keeps the field open', async () => {
    holding({
      project: {
        listFolder: f => Promise.resolve([...(FOLDERS[f] ?? [])]),
        newFolder: () =>
          Promise.resolve({ done: [], refused: [{ path: 'Neuf', reason: 'exists' }], batch: 'b' }),
      },
    })
    show('Images')
    await openTree()

    await userEvent.click(screen.getByRole('menuitem', { name: 'Nouveau dossier…' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Nom du dossier' }), '{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(LABELS.folderTaken)
    expect(screen.getByRole('textbox', { name: 'Nom du dossier' })).toBeInTheDocument()
  })
})
