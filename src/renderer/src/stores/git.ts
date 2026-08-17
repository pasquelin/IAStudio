import { create } from 'zustand'
import type {
  GitBranch,
  GitCommit,
  GitCommitFile,
  GitRemote,
  GitRepository,
} from '@shared/domain/git'
import type { GitDiff } from '@shared/domain/gitDiff'
import { getBridge } from '@/services/bridge'

/**
 * How much history one round trip brings back.
 *
 * A band shows a dozen rows and scrolls; this is several screens of them, so scrolling does not
 * hit the bottom on the first flick. A project of two years is tens of thousands of commits, and
 * reading them whole to draw twenty is what paging exists to avoid.
 */
export const HISTORY_PAGE = 60

type GitState = {
  repository: GitRepository
  /** Whether a command is in flight. What greys the buttons, so nothing is asked for twice. */
  busy: boolean
  /**
   * The commit message being written, held here rather than in the panel.
   *
   * A panel that is switched away from and back — one click on the rail — remounts, and a
   * message typed into component state would be gone. It survives a project change too, which
   * is wrong for exactly nobody: it is emptied when a commit lands.
   */
  message: string
  amend: boolean

  /**
   * The history, as far down as it has been read. Held beside the working tree rather than in a
   * store of its own: the two are one repository, and a commit made in the Git panel has to
   * appear in the History panel without either of them knowing the other exists.
   */
  commits: readonly GitCommit[]
  /** Whether the last page came back short, which is the only way to know there is no more. */
  historyEnded: boolean
  /** The version being looked at, or nothing. Its files are read when it is picked. */
  picked: string | null
  pickedFiles: readonly GitCommitFile[]

  /**
   * The file being compared, and against which version — `null` meaning the last recorded one.
   *
   * Held in the store rather than in the panel that draws it, because the two panels BOTH set it:
   * the Git panel compares a file one is about to record, the History panel a file inside a
   * version. Only the band is wide enough to draw the answer, so the narrow one asks and the wide
   * one shows.
   */
  compared: { path: string; commit: string | null } | null
  diff: GitDiff | null

  refresh: () => Promise<void>
  initRepository: () => Promise<void>
  stage: (paths: readonly string[]) => Promise<void>
  unstage: (paths: readonly string[]) => Promise<void>
  restore: (paths: readonly string[]) => Promise<void>
  commit: () => Promise<void>
  branches: () => Promise<GitBranch[]>
  createBranch: (name: string) => Promise<void>
  checkout: (name: string) => Promise<void>
  writeMessage: (message: string) => void
  setAmend: (amend: boolean) => void
  /** Reads the first page afresh, or the next one under it. */
  readHistory: (more: boolean) => Promise<void>
  pick: (hash: string | null) => Promise<void>
  compare: (path: string, commit: string | null) => Promise<void>
  stopComparing: () => void
  /**
   * The server this project talks to, or nothing.
   *
   * The FIRST one, and the studio offers no way to make a second: a project with two servers is
   * a situation git handles and a version panel would only obscure. Somebody who has one has a
   * terminal too, and the panel goes on working around it.
   */
  remote: GitRemote | null
  readRemotes: () => Promise<void>
  addRemote: (name: string, url: string) => Promise<void>
  fetch: () => Promise<void>
  pull: () => Promise<void>
  push: (setUpstream: boolean) => Promise<void>
  /** Whether a token is held for a host. The token itself never comes back this way. */
  hasCredentials: (host: string) => Promise<boolean>
  setCredentials: (host: string, user: string, token: string) => Promise<void>
}

/**
 * The repository, as this window sees it.
 *
 * A store rather than a read per panel: the Git panel and the History panel look at the same
 * folder, and two copies of one answer is two panels disagreeing about which branch is out.
 *
 * Nothing is polled. What refreshes it is `useGitStatus`, off the events the studio already
 * publishes — the project changing, its folder changing on disk, the window coming back to the
 * front. A watcher of its own over a hundred thousand files is exactly what invariant 6 forbids,
 * and the studio has one already.
 */
export const useGit = create<GitState>()((set, get) => {
  let running = 0

  const run = async (answer: Promise<GitRepository> | undefined): Promise<void> => {
    if (!answer) return

    running += 1
    set({ busy: true })
    try {
      set({ repository: await answer })
    } catch {
      // The main process answers a union for every git failure, so a rejection here means the
      // channel itself failed. What was on screen is the last thing known to be true about the
      // folder — better than a state invented from an error that says nothing about git.
    } finally {
      running -= 1
      // Only the LAST one lifts it: two panels refreshing together would otherwise have the
      // first to land clear the flag while the second is still running.
      if (running === 0) set({ busy: false })
    }
  }

  return {
    repository: { kind: 'no-project' },
    busy: false,
    message: '',
    amend: false,
    commits: [],
    historyEnded: false,
    remote: null,
    picked: null,
    pickedFiles: [],
    compared: null,
    diff: null,

    refresh: () => run(getBridge()?.git.read()),
    initRepository: () => run(getBridge()?.git.init()),
    stage: paths => run(getBridge()?.git.stage(paths)),
    unstage: paths => run(getBridge()?.git.unstage(paths)),
    restore: paths => run(getBridge()?.git.restore(paths)),

    commit: async () => {
      const { message, amend } = get()
      await run(getBridge()?.git.commit(message, amend))

      // Emptied only where the commit actually landed. A message cleared after a refusal — no
      // identity configured is the one everybody meets first — would lose what was typed at the
      // exact moment the user has to fix something and try again.
      if (get().repository.kind === 'ready') set({ message: '', amend: false })
    },

    branches: async () => (await getBridge()?.git.branches()) ?? [],
    createBranch: name => run(getBridge()?.git.createBranch(name)),
    checkout: name => run(getBridge()?.git.checkout(name)),

    writeMessage: message => set({ message }),
    setAmend: amend => set({ amend }),

    readHistory: async more => {
      const held = more ? get().commits : []
      const page = (await getBridge()?.git.log(HISTORY_PAGE, held.length)) ?? []

      set({
        commits: [...held, ...page],
        // A page that came back short is the end. Asking again to find out would cost a command
        // per scroll for the rest of the session, on a history that is not going to grow.
        historyEnded: page.length < HISTORY_PAGE,
      })
    },

    pick: async hash => {
      // Cleared FIRST: the files of the version one has just left would otherwise stay on screen
      // under the name of the one just picked, for as long as git takes to answer.
      set({ picked: hash, pickedFiles: [] })
      if (hash === null) return

      const files = (await getBridge()?.git.commitFiles(hash)) ?? []

      // Only if it is still the one being looked at. Two quick clicks race, and the slower answer
      // would otherwise land last and fill the row that is no longer picked.
      if (get().picked === hash) set({ pickedFiles: files })
    },

    compare: async (path, commit) => {
      set({ compared: { path, commit }, diff: null })

      const diff = (await getBridge()?.git.diff(path, commit)) ?? { kind: 'empty' }

      // The same race as `pick`, and it bites harder here: a diff is the slowest thing git is
      // asked for, so a second file clicked while the first is still out is the ordinary case.
      const still = get().compared
      if (still?.path === path && still.commit === commit) set({ diff })
    },

    stopComparing: () => set({ compared: null, diff: null }),

    readRemotes: async () => {
      const [first] = (await getBridge()?.git.remotes()) ?? []
      set({ remote: first ?? null })
    },

    addRemote: async (name, url) => {
      await run(getBridge()?.git.addRemote(name, url))
      await get().readRemotes()
    },
    fetch: () => run(getBridge()?.git.fetch()),
    pull: () => run(getBridge()?.git.pull()),
    push: setUpstream => run(getBridge()?.git.push(setUpstream)),

    hasCredentials: async host => (await getBridge()?.git.hasCredentials(host)) ?? false,
    setCredentials: async (host, user, token) => {
      await getBridge()?.git.setCredentials(host, user, token)
    },
  }
})
