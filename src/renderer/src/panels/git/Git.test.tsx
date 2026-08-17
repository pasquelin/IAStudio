import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitRepository, GitStatus } from '@shared/domain/git'
import { installFakeBridge } from '@/services/fake-bridge'
import { useGit } from '@/stores/git'
import { Git } from './Git'

const CLEAN: GitStatus = {
  branch: 'main',
  head: 'a3f9c1e',
  upstream: null,
  ahead: 0,
  behind: 0,
  files: [],
}

beforeEach(() => useGit.setState({ repository: { kind: 'no-project' }, busy: false }))

function panelOn(repository: GitRepository, init = vi.fn(() => Promise.resolve(repository))) {
  installFakeBridge({ git: { read: () => Promise.resolve(repository), init } })
  render(<Git />)
  return init
}

describe('the version panel before there is anything to version', () => {
  it('asks for a project when none is open', async () => {
    panelOn({ kind: 'no-project' })

    expect(await screen.findByText(/Ouvrez un projet/)).toBeTruthy()
  })

  /**
   * simple-git spawns the binary rather than speaking the protocol, and a plain Windows install
   * has none. Discovering it at the first commit would let a user arrange one that cannot happen.
   */
  it('says git is missing rather than offering a button that cannot work', async () => {
    panelOn({ kind: 'no-binary' })

    expect(await screen.findByText(/Git n’est pas installé/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('bringing a project under version control', () => {
  it('offers the way in, and takes it', async () => {
    const init = panelOn({ kind: 'uninitialised' })

    await userEvent.click(await screen.findByRole('button', { name: 'Suivre les versions' }))

    expect(init).toHaveBeenCalledTimes(1)
  })

  /** A button that greys out and comes back inside a second reads as a flicker, not as progress. */
  it('withdraws the button while the command runs', async () => {
    panelOn({ kind: 'uninitialised' })
    await screen.findByRole('button', { name: 'Suivre les versions' })

    useGit.setState({ busy: true })

    await waitFor(() => expect(screen.queryByRole('button')).toBeNull())
  })
})

describe('the folder as git sees it', () => {
  it('names the branch, and says nothing has moved', async () => {
    panelOn({ kind: 'ready', status: CLEAN })

    expect(await screen.findByText('main')).toBeTruthy()
    expect(screen.getByText(/Rien n’a changé/)).toBeTruthy()
  })

  /** `git init` leaves exactly this, and it is a state the panel has to show rather than hide. */
  it('says so when no version has been recorded yet', async () => {
    panelOn({ kind: 'ready', status: { ...CLEAN, head: null } })

    expect(await screen.findByText('Aucune version enregistrée')).toBeTruthy()
  })

  it('groups what changed under the half of git it sits in', async () => {
    panelOn({
      kind: 'ready',
      status: {
        ...CLEAN,
        files: [
          { path: 'documents/board.scimg', stage: 'staged', change: 'modified' },
          { path: 'Images/hero.png', stage: 'untracked', change: 'untracked' },
        ],
      },
    })

    expect(await screen.findByText('Retenus')).toBeTruthy()
    expect(screen.getByText('Nouveaux')).toBeTruthy()
    expect(screen.getByText('board.scimg')).toBeTruthy()
    expect(screen.getByText('hero.png')).toBeTruthy()
  })

  /**
   * A file modified, staged, then modified again belongs under both headings — and React is
   * handed the same path twice on the same list, which is what the stage in the key is for.
   */
  it('shows a file touched on both sides under both headings', async () => {
    panelOn({
      kind: 'ready',
      status: {
        ...CLEAN,
        files: [
          { path: 'documents/board.scimg', stage: 'staged', change: 'modified' },
          { path: 'documents/board.scimg', stage: 'unstaged', change: 'modified' },
        ],
      },
    })

    expect(await screen.findAllByText('board.scimg')).toHaveLength(2)
  })
})

describe('a command git refused', () => {
  it('says why in the studio own words, and shows git line under it', async () => {
    panelOn({
      kind: 'failed',
      reason: 'locked',
      detail: 'fatal: Unable to create .git/index.lock: File exists',
    })

    expect(await screen.findByText(/Une autre commande git occupe ce dossier/)).toBeTruthy()
    expect(screen.getByText(/index\.lock/)).toBeTruthy()
  })
})
