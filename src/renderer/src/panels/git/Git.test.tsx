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

const CLEAN_READY: GitRepository = { kind: 'ready', status: CLEAN }

beforeEach(() =>
  useGit.setState({ repository: { kind: 'no-project' }, busy: false, message: '', amend: false }),
)

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

    expect(await screen.findByRole('button', { name: 'main' })).toBeTruthy()
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

const CHANGED: GitRepository = {
  kind: 'ready',
  status: {
    ...CLEAN,
    files: [
      { path: 'documents/board.scimg', stage: 'staged', change: 'modified' },
      { path: 'Images/hero.png', stage: 'unstaged', change: 'modified' },
      { path: 'Videos/take.mp4', stage: 'untracked', change: 'untracked' },
    ],
  },
}

describe('the tick, which is the index', () => {
  it('adds a file to the next version when it is ticked', async () => {
    const stage = vi.fn(() => Promise.resolve(CHANGED))
    installFakeBridge({ git: { read: () => Promise.resolve(CHANGED), stage } })
    render(<Git />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Images/hero.png' }))

    expect(stage).toHaveBeenCalledWith(['Images/hero.png'])
  })

  it('takes one back out when it is unticked', async () => {
    const unstage = vi.fn(() => Promise.resolve(CHANGED))
    installFakeBridge({ git: { read: () => Promise.resolve(CHANGED), unstage } })
    render(<Git />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'documents/board.scimg' }))

    expect(unstage).toHaveBeenCalledWith(['documents/board.scimg'])
  })

  /** A project touched by an import has as many changed files as the import wrote. */
  it('takes a whole group in one gesture', async () => {
    const stage = vi.fn(() => Promise.resolve(CHANGED))
    installFakeBridge({ git: { read: () => Promise.resolve(CHANGED), stage } })
    render(<Git />)

    await userEvent.click(await screen.findByRole('button', { name: 'Tout cocher dans Modifiés' }))

    expect(stage).toHaveBeenCalledWith(['Images/hero.png'])
  })
})

describe('putting a file back', () => {
  /**
   * A file git has never seen has no earlier version to go back to. The only other reading of
   * the gesture is a deletion, and that belongs to the Explorer, one icon along.
   */
  it('is offered for a file with an earlier version, and withheld for one without', async () => {
    panelOn(CHANGED)

    expect(await screen.findByRole('button', { name: 'Restaurer Images/hero.png' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Restaurer Videos/take.mp4' })).toBeNull()
  })

  it('restores the one path it was clicked on', async () => {
    const restore = vi.fn(() => Promise.resolve(CHANGED))
    installFakeBridge({ git: { read: () => Promise.resolve(CHANGED), restore } })
    render(<Git />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Restaurer documents/board.scimg' }),
    )

    expect(restore).toHaveBeenCalledWith(['documents/board.scimg'])
  })
})

describe('recording a version', () => {
  it('refuses until something is both ticked and said', async () => {
    panelOn(CHANGED)
    const button = await screen.findByRole('button', { name: 'Commit' })

    expect(button).toBeDisabled()

    await userEvent.type(screen.getByRole('textbox', { name: 'Ce que dit cette version' }), 'plan')
    expect(button).toBeEnabled()
  })

  it('hands git the message that was typed', async () => {
    const commit = vi.fn(() => Promise.resolve(CHANGED))
    installFakeBridge({ git: { read: () => Promise.resolve(CHANGED), commit } })
    render(<Git />)

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Ce que dit cette version' }),
      'un plan large',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }))

    expect(commit).toHaveBeenCalledWith('un plan large', false)
  })

  /**
   * No identity configured is the refusal everybody meets first. Clearing the field there would
   * lose what was typed at the exact moment the user has to fix something and try again.
   */
  it('keeps the message when git refused, and clears it when it landed', async () => {
    const refused: GitRepository = { kind: 'failed', reason: 'no-identity', detail: 'who are you' }
    installFakeBridge({
      git: { read: () => Promise.resolve(CHANGED), commit: () => Promise.resolve(refused) },
    })
    render(<Git />)

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Ce que dit cette version' }),
      'un plan large',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }))

    await waitFor(() => expect(useGit.getState().repository).toEqual(refused))
    expect(useGit.getState().message).toBe('un plan large')
  })

  /** Rewording the last message stages nothing, so the box has to stand on its own. */
  it('lets an amend through with nothing ticked', async () => {
    const commit = vi.fn(() => Promise.resolve(CLEAN_READY))
    installFakeBridge({ git: { read: () => Promise.resolve(CLEAN_READY), commit } })
    render(<Git />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Corriger la dernière' }))
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Ce que dit cette version' }),
      'meilleur titre',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }))

    expect(commit).toHaveBeenCalledWith('meilleur titre', true)
  })

  /** Before the first commit there is no last version to correct, so the box promises nothing. */
  it('offers no amend on a repository with no history', async () => {
    panelOn({ kind: 'ready', status: { ...CLEAN, head: null } })
    await screen.findByRole('button', { name: 'Commit' })

    expect(screen.queryByRole('checkbox', { name: 'Corriger la dernière' })).toBeNull()
  })
})

describe('the branch button', () => {
  it('lists what there is and swings the folder over to the one chosen', async () => {
    const checkout = vi.fn(() => Promise.resolve(CLEAN_READY))
    installFakeBridge({
      git: {
        read: () => Promise.resolve(CLEAN_READY),
        branches: () =>
          Promise.resolve([
            { name: 'main', current: true },
            { name: 'essai-lumiere', current: false },
          ]),
        checkout,
      },
    })
    render(<Git />)

    await userEvent.click(await screen.findByRole('button', { name: 'main' }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'essai-lumiere' }))

    expect(checkout).toHaveBeenCalledWith('essai-lumiere')
  })

  /**
   * A repository with no first commit lists no branch at all — git has none until something is
   * recorded — so the menu would hold the single row that makes one. The click goes straight to
   * the field instead of opening a list of one.
   */
  it('opens a field for a new one, and refuses a name git would not take', async () => {
    const createBranch = vi.fn(() => Promise.resolve(CLEAN_READY))
    installFakeBridge({ git: { read: () => Promise.resolve(CLEAN_READY), createBranch } })
    render(<Git />)

    await userEvent.click(await screen.findByRole('button', { name: 'main' }))

    const field = await screen.findByRole('textbox', { name: 'Nouvelle branche' })
    await userEvent.type(field, 'essai lumiere{Enter}')
    expect(createBranch).not.toHaveBeenCalled()

    await userEvent.clear(field)
    await userEvent.type(field, 'essai-lumiere{Enter}')
    expect(createBranch).toHaveBeenCalledWith('essai-lumiere')
  })
})

describe('the server this project talks to', () => {
  const AHEAD: GitRepository = {
    kind: 'ready',
    status: { ...CLEAN, upstream: 'origin/main', ahead: 2, behind: 1 },
  }

  const withRemote = (repository: GitRepository, overrides = {}) =>
    installFakeBridge({
      git: {
        read: () => Promise.resolve(repository),
        remotes: () => Promise.resolve([{ name: 'origin', url: 'https://github.com/a/b.git' }]),
        ...overrides,
      },
    })

  it('says what is waiting each way, and moves it', async () => {
    const push = vi.fn(() => Promise.resolve(AHEAD))
    withRemote(AHEAD, { push })
    render(<Git />)

    expect(await screen.findByText('2 à envoyer')).toBeTruthy()
    expect(screen.getByText('1 à recevoir')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    expect(push).toHaveBeenCalledWith(false)
  })

  /**
   * The first push of a branch has nothing ahead to send and nothing to track. Refusing it there
   * would leave no way to make the branch on the server at all.
   */
  it('offers the first push of a branch that tracks nothing', async () => {
    const push = vi.fn(() => Promise.resolve(CLEAN_READY))
    withRemote(CLEAN_READY, { push })
    render(<Git />)

    await userEvent.click(await screen.findByRole('button', { name: 'Envoyer' }))

    expect(push).toHaveBeenCalledWith(true)
  })

  it('asks where to send once there is a version and no server', async () => {
    const addRemote = vi.fn(() => Promise.resolve(CLEAN_READY))
    installFakeBridge({ git: { read: () => Promise.resolve(CLEAN_READY), addRemote } })
    render(<Git />)

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Adresse du serveur' }),
      'https://github.com/a/b.git',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Relier' }))

    expect(addRemote).toHaveBeenCalledWith('origin', 'https://github.com/a/b.git')
  })
})

describe('a server that refused', () => {
  const REFUSED: GitRepository = {
    kind: 'failed',
    reason: 'authentication',
    detail: 'fatal: Authentication failed',
  }

  /**
   * The token goes DOWN and never comes back: there is no channel that answers with one. Asked at
   * the moment of the refusal rather than up front, which would be asking for a secret before it
   * is needed, from somebody who may never push at all.
   */
  it('asks for a token, keeps it, and runs the refused send again', async () => {
    const setCredentials = vi.fn(() => Promise.resolve())
    const push = vi.fn(() => Promise.resolve(CLEAN_READY))
    installFakeBridge({
      git: {
        read: () => Promise.resolve(REFUSED),
        remotes: () => Promise.resolve([{ name: 'origin', url: 'https://github.com/a/b.git' }]),
        setCredentials,
        push,
      },
    })
    render(<Git />)

    await userEvent.type(await screen.findByRole('textbox', { name: 'Nom d’utilisateur' }), 'alban')
    await userEvent.type(screen.getByLabelText('Jeton'), 'ghp_secret')
    await userEvent.click(screen.getByRole('button', { name: 'Retenir et réessayer' }))

    await waitFor(() =>
      expect(setCredentials).toHaveBeenCalledWith('github.com', 'alban', 'ghp_secret'),
    )
    await waitFor(() => expect(push).toHaveBeenCalled())
  })

  /** A screen being recorded is what a studio's screen often is. */
  it('hides the token as it is typed', async () => {
    installFakeBridge({
      git: {
        read: () => Promise.resolve(REFUSED),
        remotes: () => Promise.resolve([{ name: 'origin', url: 'https://github.com/a/b.git' }]),
      },
    })
    render(<Git />)

    expect(await screen.findByLabelText('Jeton')).toHaveAttribute('type', 'password')
  })

  /**
   * An SSH remote is answered by the machine's own key and agent. A token field there would be a
   * question nothing does anything with.
   */
  it('offers no token field for a server reached over ssh', async () => {
    installFakeBridge({
      git: {
        read: () => Promise.resolve(REFUSED),
        remotes: () => Promise.resolve([{ name: 'origin', url: 'git@github.com:a/b.git' }]),
      },
    })
    render(<Git />)

    expect(await screen.findByText(/Le serveur distant a refusé vos identifiants/)).toBeTruthy()
    expect(screen.queryByLabelText('Jeton')).toBeNull()
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
