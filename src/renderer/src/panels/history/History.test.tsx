import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitCommit, GitCommitFile, GitRepository } from '@shared/domain/git'
import { installFakeBridge } from '@/services/fake-bridge'
import { HISTORY_PAGE, useGit } from '@/stores/git'
import { History } from './History'

const READY: GitRepository = {
  kind: 'ready',
  status: { branch: 'main', head: 'a3f9c1e', upstream: null, ahead: 0, behind: 0, files: [] },
}

const commit = (hash: string, message: string, ...parents: string[]): GitCommit => ({
  hash,
  parents,
  message,
  author: 'Alban',
  at: '2026-08-17T10:42:00Z',
  refs: [],
})

beforeEach(() =>
  useGit.setState({
    repository: { kind: 'no-project' },
    busy: false,
    commits: [],
    historyEnded: false,
    picked: null,
    pickedFiles: [],
  }),
)

describe('the history before there is one', () => {
  /**
   * The Git panel is looking at the same folder and carries the screen that explains the four
   * states before `ready`, with the button that acts on them. Saying it twice would be twice.
   */
  it('sends the reader to the Git panel rather than repeating its screens', async () => {
    installFakeBridge({ git: { read: () => Promise.resolve({ kind: 'uninitialised' }) } })
    render(<History />)

    expect(await screen.findByText(/panneau Git dit où en est ce projet/)).toBeTruthy()
  })

  it('says so when the folder is versioned but holds no version yet', async () => {
    installFakeBridge({
      git: { read: () => Promise.resolve(READY), log: () => Promise.resolve([]) },
    })
    render(<History />)

    expect(await screen.findByText(/Aucune version enregistrée pour l’instant/)).toBeTruthy()
  })
})

describe('the versions recorded', () => {
  const HISTORY = [commit('a3f9c1e', 'Ajout du plan large', 'b1c2d3e'), commit('b1c2d3e', 'Départ')]

  it('lists what each one says, newest first', async () => {
    installFakeBridge({
      git: { read: () => Promise.resolve(READY), log: () => Promise.resolve(HISTORY) },
    })
    render(<History />)

    const rows = await screen.findAllByRole('button', { pressed: false })
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining('Ajout du plan large'),
      expect.stringContaining('Départ'),
    ])
  })

  it('shows the short hash, which is how one names a version out loud', async () => {
    installFakeBridge({
      git: { read: () => Promise.resolve(READY), log: () => Promise.resolve(HISTORY) },
    })
    render(<History />)

    expect(await screen.findByText('a3f9c1e')).toBeTruthy()
  })

  it('reads the files of the version that is picked, and only then', async () => {
    const changed: GitCommitFile[] = [{ path: 'documents/board.scimg', change: 'modified' }]
    const commitFiles = vi.fn(() => Promise.resolve(changed))
    installFakeBridge({
      git: {
        read: () => Promise.resolve(READY),
        log: () => Promise.resolve(HISTORY),
        commitFiles,
      },
    })
    render(<History />)

    expect(commitFiles).not.toHaveBeenCalled()

    await userEvent.click(await screen.findByRole('button', { name: /Ajout du plan large/ }))

    expect(commitFiles).toHaveBeenCalledWith('a3f9c1e')
    expect(await screen.findByText('board.scimg')).toBeTruthy()
  })

  /** A second click on the row one is looking at closes the column rather than reloading it. */
  it('puts the column away when the picked version is clicked again', async () => {
    installFakeBridge({
      git: { read: () => Promise.resolve(READY), log: () => Promise.resolve(HISTORY) },
    })
    render(<History />)

    const row = await screen.findByRole('button', { name: /Ajout du plan large/ })
    await userEvent.click(row)
    expect(await screen.findByText('Fichiers de cette version')).toBeTruthy()

    await userEvent.click(row)
    expect(screen.queryByText('Fichiers de cette version')).toBeNull()
  })
})

describe('the names a version carries', () => {
  /**
   * A tag is a DECISION somebody made — a delivery, a version shown to a client — and it is what
   * a person scrolls a history looking for. Scrolling for `a3f9c1e` is what naming replaces.
   */
  it('draws them on the row, tag included', async () => {
    installFakeBridge({
      git: {
        read: () => Promise.resolve(READY),
        log: () =>
          Promise.resolve([
            {
              ...commit('a3f9c1e', 'Ajout du plan large'),
              refs: [
                { kind: 'branch', name: 'main' },
                { kind: 'tag', name: 'livraison-client' },
              ],
            },
          ]),
      },
    })
    render(<History />)

    expect(await screen.findByText('livraison-client')).toBeTruthy()
    expect(screen.getByText('main')).toBeTruthy()
  })

  it('names the version that is picked', async () => {
    const tag = vi.fn(() => Promise.resolve(READY))
    installFakeBridge({
      git: {
        read: () => Promise.resolve(READY),
        log: () => Promise.resolve([commit('a3f9c1e', 'Ajout du plan large')]),
        tag,
      },
    })
    render(<History />)

    await userEvent.click(await screen.findByRole('button', { name: /Ajout du plan large/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nommer cette version' }))
    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Nommer cette version' }),
      'livraison-client{Enter}',
    )

    expect(tag).toHaveBeenCalledWith('livraison-client', 'a3f9c1e')
  })
})

describe('reading further down', () => {
  /**
   * A page that came back short is the end. Asking again to find out would cost a command per
   * scroll for the rest of the session, on a history that is not going to grow.
   */
  it('offers no way further down once a page came back short', async () => {
    installFakeBridge({
      git: { read: () => Promise.resolve(READY), log: () => Promise.resolve([commit('a1', 'Un')]) },
    })
    render(<History />)

    await screen.findByText('Un')
    expect(screen.queryByRole('button', { name: 'Voir plus' })).toBeNull()
  })

  it('asks for the next page, skipping what is already held', async () => {
    const full = Array.from({ length: HISTORY_PAGE }, (_, index) =>
      commit(`hash${index}`, `Version ${index}`),
    )
    const log = vi.fn(() => Promise.resolve(full))
    installFakeBridge({ git: { read: () => Promise.resolve(READY), log } })
    render(<History />)

    await userEvent.click(await screen.findByRole('button', { name: 'Voir plus' }))

    expect(log).toHaveBeenLastCalledWith(HISTORY_PAGE, HISTORY_PAGE)
  })
})
