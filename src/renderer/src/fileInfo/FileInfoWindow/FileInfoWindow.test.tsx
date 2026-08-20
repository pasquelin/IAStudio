import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { fileInfoRoute, type FileFacts } from '@shared/domain/fileInfo'
import type { GitRepository } from '@shared/domain/git'
import { installFakeBridge } from '@/services/fakeBridge'
import { useGit } from '@/stores/git'
import { gitReadyRepository } from '@/stores/git-fixtures'
import { FileInfoWindow } from './FileInfoWindow'

const VERSIONED = gitReadyRepository({
  files: [{ path: 'Images/facade.jpg', change: 'modified', stage: 'unstaged' }],
})

const FACTS: FileFacts = {
  kind: 'file',
  bytes: 2_097_152,
  createdAt: '2026-08-16T09:30:00.000Z',
  modifiedAt: '2026-08-17T18:05:00.000Z',
}

const PICTURE: Asset = {
  id: 'asset_facade',
  name: 'facade',
  type: 'image',
  location: 'local',
  path: 'Images/facade.jpg',
  width: 1024,
  height: 768,
  hash: 'ab12cd34',
  tags: [],
  createdAt: '2026-08-16T09:30:00.000Z',
}

function open(
  path: string,
  facts: FileFacts | null,
  asset: Asset | null = null,
  repository: GitRepository = { kind: 'uninitialised' },
): void {
  window.location.hash = fileInfoRoute(path)
  installFakeBridge({
    project: { fileFacts: () => Promise.resolve(facts) },
    assets: { search: () => Promise.resolve(asset ? [asset] : []) },
    git: { read: () => Promise.resolve(repository) },
  })
}

describe('FileInfoWindow', () => {
  beforeEach(() => {
    window.location.hash = ''
    useGit.setState({ repository: { kind: 'no-project' }, busy: false, message: '', amend: false })
  })

  /**
   * The arbitration this window was built on: a `.txt` will never have a catalogue row, so the
   * two runs that read one are ABSENT rather than shown empty.
   */
  it('shows the disk alone for a file the catalogue does not know', async () => {
    open('Notes/brief.txt', { ...FACTS, bytes: 4096 })
    render(<FileInfoWindow />)

    expect(await screen.findByText('Notes/brief.txt')).toBeInTheDocument()
    expect(screen.queryByText('Catalogue')).not.toBeInTheDocument()
    expect(screen.queryByText('Média')).not.toBeInTheDocument()
  })

  /** One block: every run is on screen at once, so nothing has to be gone looking for. */
  it('draws what the catalogue holds under the disk, without a control to reach it', async () => {
    open('Images/facade.jpg', FACTS, PICTURE)
    render(<FileInfoWindow />)

    expect(await screen.findByText('Média')).toBeInTheDocument()
    expect(screen.getByText('Catalogue')).toBeInTheDocument()
    expect(screen.getByText('1024 × 768')).toBeInTheDocument()
    expect(screen.getByText('ab12cd34')).toBeInTheDocument()
  })

  /**
   * The other half of « absent rather than empty », and the one the arbitration turns on: a row
   * the catalogue holds WITHOUT dimensions earns « Catalogue » and no « Média ». Without this
   * case the whole predicate collapses to `asset !== null` with every other case still green.
   */
  it('leaves out Média for a catalogued file whose row carries no dimensions', async () => {
    open('Notes/brief.txt', FACTS, { ...PICTURE, width: undefined, height: undefined })
    render(<FileInfoWindow />)

    expect(await screen.findByText('Catalogue')).toBeInTheDocument()
    expect(screen.queryByText('Média')).not.toBeInTheDocument()
  })

  /** The window is named by a right-click, and the file can go before anyone reads it. */
  it('says the entry has gone rather than drawing an empty pane', async () => {
    open('Images/facade.jpg', null)
    render(<FileInfoWindow />)

    expect(
      await screen.findByText('Cette entrée n’est plus dans le dossier du projet.'),
    ).toBeInTheDocument()
  })

  /**
   * A folder is not a domain — `ProjectItem` says so — and its own entry weighs ninety-six bytes,
   * which says nothing about what it holds. Both rows are left out rather than filled with a
   * number that would be read as the folder's weight.
   */
  it('leaves out the type and the size of a folder', async () => {
    open('Images', { ...FACTS, kind: 'folder' })
    render(<FileInfoWindow />)

    expect(await screen.findByText('Dossier')).toBeInTheDocument()
    expect(screen.queryByText('Type')).not.toBeInTheDocument()
    expect(screen.queryByText('Taille')).not.toBeInTheDocument()
  })

  /** The project's own version control, read for THIS file — git's word, not a guess at it. */
  it('says what git holds against the file when the project is versioned', async () => {
    open('Images/facade.jpg', FACTS, PICTURE, VERSIONED)
    render(<FileInfoWindow />)

    expect(await screen.findByText('main')).toBeInTheDocument()
    // Read off the row rather than off the page: « Modifié le » sits in Général two runs above,
    // so a bare text query would pass for a reason that has nothing to do with git.
    expect(screen.getByTitle('État').parentElement).toHaveTextContent('Modifié')
  })

  /**
   * Git reports FILES. A folder has no line of its own there, so a Git run for one would answer
   * about the project instead of about the entry that was right-clicked.
   */
  it('draws no Git run for a folder, versioned project or not', async () => {
    open('Images', { ...FACTS, kind: 'folder' }, null, VERSIONED)
    render(<FileInfoWindow />)

    expect(await screen.findByText('Dossier')).toBeInTheDocument()
    expect(screen.queryByText('Git')).not.toBeInTheDocument()
  })

  /**
   * Read only, which is what tells this window from the inspector's own face: `RoleField` writes
   * the catalogue, and the same right-click opens this on files no catalogue holds.
   */
  it('offers no control that would write anything', async () => {
    open('Images/facade.jpg', FACTS, PICTURE)
    render(<FileInfoWindow />)

    expect(await screen.findByText('Images/facade.jpg')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
