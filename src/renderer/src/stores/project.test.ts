import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { projectName, type Project, type RecentProject } from '@shared/domain/project'
import type * as DocumentIo from '@/features/shell/documentIo'
import { installFakeBridge, type BridgeOverrides } from '@/services/fakeBridge'
import type { ActivityEntry } from '@shared/domain/activity'
import type { FileOutcome } from '@shared/domain/fileOp'
import { useActivity } from './activity'
import { assetsById, useAssets } from './assets'
import { useProject } from './project'
import type { ProjectBinned } from '@shared/ipc'
import { selectedFilePaths, useSelection } from './selection'
import { useSettings } from './settings'
import { ASSISTANT_ROLE, type AiRoleId, type RoleProvider } from '@shared/domain/aiRole'

const closeOrphanTabs = vi.hoisted(() => vi.fn())
vi.mock('@/features/shell/orphanTabs', () => ({ closeOrphanTabs }))

// Only the question: `refreshDocuments` on the same module is what every case below leans on,
// and a whole fake of it would leave `followProject` asserting nothing.
const settleUnsavedWorkForProjectChange = vi.hoisted(() => vi.fn(async () => true))
vi.mock('@/features/shell/documentIo', async importOriginal => ({
  ...(await importOriginal<typeof DocumentIo>()),
  settleUnsavedWorkForProjectChange,
}))

const MANIFEST = { version: 1, name: 'demo', createdAt: '', updatedAt: '' }

const nothingMoved = (): Promise<FileOutcome> =>
  Promise.resolve({ done: [], refused: [], batch: 'batch-1' })

/** A toast standing on screen — what following another project is right to sweep away, and a
 *  rename is not. */
const TOAST: ActivityEntry = {
  id: 1,
  at: '2026-08-13T10:00:00.000Z',
  level: 'error',
  topic: 'project',
  messageKey: 'activity.projectNotRenamed',
}

beforeEach(() => {
  useProject.setState({ project: null, known: false })
  closeOrphanTabs.mockClear()
  settleUnsavedWorkForProjectChange.mockClear()
  settleUnsavedWorkForProjectChange.mockResolvedValue(true)
  installFakeBridge()
})

/**
 * `known` is what the home waits on before drawing anything: the initial `null` is "not asked
 * yet", not "no project". Every way out of `connect` has to settle it, or the studio opens on a
 * blank page nothing will ever fill.
 */
describe('saying that the answer has arrived', () => {
  it('settles on what the main process holds', async () => {
    await useProject.getState().connect()

    expect(useProject.getState().known).toBe(true)
    expect(useProject.getState().project).toBeNull()
  })

  it('settles even with no bridge to ask, as a plain browser has none', async () => {
    vi.unstubAllGlobals()

    const stop = await useProject.getState().connect()

    expect(useProject.getState().known).toBe(true)
    expect(stop).toBeTypeOf('function')
  })

  // Left to throw, `connect` also never hands back the unsubscribe, stranding the listener.
  it('settles when the main process refuses to say which project is open', async () => {
    installFakeBridge({ project: { current: () => Promise.reject(new Error('no project')) } })

    const stop = await useProject.getState().connect()

    expect(useProject.getState().known).toBe(true)
    expect(stop).toBeTypeOf('function')
  })
})

/**
 * A tab restored on startup outlives its document: the layout is persisted and the documents
 * are not, so one created and never saved comes back as a tab that says it is not open.
 */
describe('settling the tabs of a project being followed', () => {
  it('closes what the folder and the store both disown', async () => {
    await useProject.getState().connect()

    expect(closeOrphanTabs).toHaveBeenCalled()
  })

  // A folder that went away leaves every document missing, which looks exactly like a project
  // of ghosts — and closing on it would cost a live arrangement for good.
  it('closes nothing when the folder could not be read', async () => {
    installFakeBridge({ documents: { list: () => Promise.reject(new Error('no folder')) } })

    await useProject.getState().connect()

    expect(closeOrphanTabs).not.toHaveBeenCalled()
  })

  /**
   * Announcing the SAME folder is a manifest that changed under it — a rename is the one gesture
   * that does — and following it would empty the scene clipboard, dismiss every toast and refetch
   * three lists in every window, to update a word.
   *
   * The unread toasts are the witness because they are dismissed SYNCHRONOUSLY, before the three
   * requests: `closeOrphanTabs`, the last thing following a project does, sits behind three
   * awaits, so an assertion made on it right after the announcement passes whether the work was
   * skipped or merely not finished — which is what this test did until it was checked by removing
   * the guard and watching it stay green.
   */
  it('follows another project, and stays put when the same folder announces itself', async () => {
    const listeners: ((project: Project | null) => void)[] = []
    const announce = (project: Project): void => listeners.forEach(listener => listener(project))
    installFakeBridge({
      project: {
        onChange: listener => {
          listeners.push(listener)
          return () => {}
        },
      },
    })
    await useProject.getState().connect()

    useActivity.setState({ unread: [TOAST] })
    announce({ path: '/projects/Summer', manifest: MANIFEST })

    expect(useActivity.getState().unread).toEqual([])

    useActivity.setState({ unread: [TOAST] })
    announce({ path: '/projects/Summer', manifest: MANIFEST })

    // 🛑 The same folder again is a manifest that moved under it, never another project: following
    // it would empty the scene clipboard and dismiss every toast to update nothing.
    expect(useActivity.getState().unread).toEqual([TOAST])
    expect(useProject.getState().project?.path).toBe('/projects/Summer')
  })

  /**
   * The by-id index remembers every asset it has been shown, so that narrowing the browser's
   * facet cannot take the names off an open montage. Following another project is the one thing
   * that says a catalogue is over — without this, its rows answer lookups for the next one.
   *
   * Awaited, and that is the case rather than a detail: the forgetting has to happen AFTER the
   * new catalogue has been read. Until then `items` still holds the rows being left, so a
   * forget placed first is undone by any render that reads the index in that window.
   */
  it('leaves the assets of the project it is leaving behind', async () => {
    const listeners: ((project: Project | null) => void)[] = []
    installFakeBridge({
      project: {
        onChange: listener => {
          listeners.push(listener)
          return () => {}
        },
      },
    })
    await useProject.getState().connect()

    useAssets.setState({
      items: [
        {
          id: 'a',
          name: 'One',
          type: 'image',
          location: 'local',
          tags: [],
          createdAt: '2026-08-14',
        },
      ],
    })
    expect(assetsById(useAssets.getState()).get('a')).toBeDefined()

    listeners.forEach(listener => listener({ path: '/projects/Winter', manifest: MANIFEST }))
    // The index read while the new catalogue is still being fetched, which is what a panel
    // rendering in that window does — and what used to put the old rows back for good.
    assetsById(useAssets.getState())

    await vi.waitFor(() => expect(assetsById(useAssets.getState()).get('a')).toBeUndefined())
  })

  /**
   * A folder row is named by its path INSIDE the project, so `Repérages/ruelle.png` names a file
   * in whichever project is open. Left picked across a change, the explorer of the new one
   * highlighted a row nobody chose — and every gesture of that panel acts on the selection.
   */
  it('unpicks what was picked in the project it is leaving', async () => {
    const listeners: ((project: Project | null) => void)[] = []
    installFakeBridge({
      project: {
        onChange: listener => {
          listeners.push(listener)
          return () => {}
        },
      },
    })
    await useProject.getState().connect()
    useSelection.getState().selectFiles(['Repérages/ruelle.png'])

    listeners.forEach(listener => listener({ path: '/projects/Winter', manifest: MANIFEST }))

    expect(selectedFilePaths(useSelection.getState())).toEqual([])
  })
})

/** Switching to a project the shelf already holds — the menu's rows and the home's list. */
describe('opening a folder the studio already knows', () => {
  beforeEach(() => {
    useProject.setState({ project: { path: '/projects/Summer', manifest: MANIFEST }, known: true })
  })

  it('switches to it once the unsaved work has been answered for', async () => {
    const open = vi.fn(() => Promise.resolve({ path: '/projects/Winter', manifest: MANIFEST }))
    installFakeBridge({ project: { open } })

    await expect(useProject.getState().open('/projects/Winter')).resolves.toBe(true)

    expect(open).toHaveBeenCalledWith('/projects/Winter')
  })

  // Switching takes the generations out of the bar exactly as closing does, so it owes the same
  // question — and in the same order, before anything is asked about documents.
  it('asks about the generations first, and stays put on a no', async () => {
    const askLeave = vi.fn(() => Promise.resolve(false))
    const open = vi.fn(() => Promise.resolve({ path: '/projects/Winter', manifest: MANIFEST }))
    installFakeBridge({ project: { askLeave, open } })

    await expect(useProject.getState().open('/projects/Winter')).resolves.toBe(false)

    expect(askLeave).toHaveBeenCalled()
    expect(settleUnsavedWorkForProjectChange).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('stays where it is when that question is cancelled', async () => {
    const open = vi.fn(() => Promise.resolve({ path: '/projects/Winter', manifest: MANIFEST }))
    installFakeBridge({ project: { open } })
    settleUnsavedWorkForProjectChange.mockResolvedValue(false)

    await expect(useProject.getState().open('/projects/Winter')).resolves.toBe(false)

    expect(open).not.toHaveBeenCalled()
    expect(useProject.getState().project?.path).toBe('/projects/Summer')
  })

  // Choosing the row already ticked means "yes, still" — there is nothing to answer for.
  it('asks nothing at all for the project already in front', async () => {
    await expect(useProject.getState().open('/projects/Summer')).resolves.toBe(true)

    expect(settleUnsavedWorkForProjectChange).not.toHaveBeenCalled()
  })
})

/**
 * Making a project at a named path — what an outside client reaches for, where a person gets the
 * picker. It leaves the open project like everything else here, and used to be the one gesture
 * that did it without asking anything.
 */
describe('making a project at a path', () => {
  const made = { path: '/projects/neuf', manifest: MANIFEST }

  beforeEach(() => {
    useProject.setState({ project: { path: '/projects/Summer', manifest: MANIFEST }, known: true })
  })

  it('asks on the way out, then makes the folder into a project', async () => {
    const create = vi.fn(() => Promise.resolve(made))
    installFakeBridge({ project: { create } })

    await expect(useProject.getState().createAt('/projects/neuf')).resolves.toEqual(made)

    expect(settleUnsavedWorkForProjectChange).toHaveBeenCalled()
    expect(useProject.getState().project?.path).toBe('/projects/neuf')
  })

  it('makes nothing when the question on the way out is answered no', async () => {
    const create = vi.fn(() => Promise.resolve(made))
    installFakeBridge({ project: { create } })
    settleUnsavedWorkForProjectChange.mockResolvedValue(false)

    await expect(useProject.getState().createAt('/projects/neuf')).resolves.toBeNull()

    expect(create).not.toHaveBeenCalled()
    expect(useProject.getState().project?.path).toBe('/projects/Summer')
  })

  // The main process asks about a folder that already holds files, and `null` is that no.
  it('stays where it is when the main process was turned down', async () => {
    installFakeBridge({ project: { create: () => Promise.resolve(null) } })

    await expect(useProject.getState().createAt('/projects/neuf')).resolves.toBeNull()

    expect(useProject.getState().project?.path).toBe('/projects/Summer')
  })
})

/**
 * Every caller does `void openPicked()` — the home's tools, the rail, the native menu and now
 * the explorer's empty state. A refusal left to throw was therefore an unhandled rejection,
 * and the main process has already written the reason in the journal on its way past.
 */
describe('picking a folder in the dialog', () => {
  const picking = (folder: string | null) => ({
    dialog: { pickPath: () => Promise.resolve(folder) },
  })

  it('opens the folder that was picked', async () => {
    const open = vi.fn(() => Promise.resolve({ path: '/p', manifest: MANIFEST }))
    installFakeBridge({ ...picking('/p'), project: { open } })

    await useProject.getState().openPicked()

    expect(open).toHaveBeenCalledWith('/p')
    expect(useProject.getState().project?.path).toBe('/p')
  })

  /**
   * After the folder is chosen and before anything is torn down. The other order put a question
   * about documents in front of someone who had just changed their mind about the picker.
   */
  it('asks about unsaved work only once a folder has been chosen', async () => {
    const open = vi.fn(() => Promise.resolve({ path: '/p', manifest: MANIFEST }))
    installFakeBridge({ ...picking(null), project: { open } })

    await useProject.getState().openPicked()

    expect(settleUnsavedWorkForProjectChange).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  // The third door, and the last one that was silent about it.
  it('opens nothing when the generations question is turned down', async () => {
    const askLeave = vi.fn(() => Promise.resolve(false))
    const open = vi.fn(() => Promise.resolve({ path: '/p', manifest: MANIFEST }))
    installFakeBridge({ ...picking('/p'), project: { askLeave, open } })

    await useProject.getState().openPicked()

    expect(askLeave).toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('opens nothing when that question is cancelled', async () => {
    const open = vi.fn(() => Promise.resolve({ path: '/p', manifest: MANIFEST }))
    installFakeBridge({ ...picking('/p'), project: { open } })
    settleUnsavedWorkForProjectChange.mockResolvedValue(false)

    await useProject.getState().openPicked()

    expect(open).not.toHaveBeenCalled()
    expect(useProject.getState().project).toBeNull()
  })

  it('survives a folder that will not open', async () => {
    installFakeBridge(picking('/not-a-project'))

    await expect(useProject.getState().openPicked()).resolves.toBeUndefined()
    expect(useProject.getState().project).toBeNull()
  })

  // The folder chosen IS the project: nothing but its path crosses, and the name comes from it
  // on the other side. Sending a name made a subfolder inside the folder the user had picked.
  it('makes the folder that was picked into the project', async () => {
    const create = vi.fn(() => Promise.resolve({ path: '/p', manifest: MANIFEST }))
    installFakeBridge({ ...picking('/p'), project: { create } })

    await useProject.getState().createPicked()

    expect(create).toHaveBeenCalledWith('/p')
    expect(useProject.getState().project?.path).toBe('/p')
  })

  // The main process asks before writing into a folder that holds files, and a "no" comes back
  // as `null`. Read as a project, it would blank the one that is open.
  it('leaves the open project alone when the creation is declined', async () => {
    const create = vi.fn(() => Promise.resolve(null))
    installFakeBridge({ ...picking('/p'), project: { create } })
    useProject.setState({ project: { path: '/open', manifest: MANIFEST }, known: true })

    await useProject.getState().createPicked()

    expect(useProject.getState().project?.path).toBe('/open')
  })

  it('survives a folder that cannot be written', async () => {
    installFakeBridge(picking('/read-only'))

    await expect(useProject.getState().createPicked()).resolves.toBeUndefined()
    expect(useProject.getState().project).toBeNull()
  })

  it('does nothing at all when the dialog is cancelled', async () => {
    const open = vi.fn(() => Promise.resolve({ path: '/p', manifest: MANIFEST }))
    installFakeBridge({ ...picking(null), project: { open } })

    await useProject.getState().openPicked()

    expect(open).not.toHaveBeenCalled()
  })

  /**
   * Where the dialog starts, and it is not cosmetic: the system reopens one wherever it was last
   * left, which after a creation is INSIDE the project just made — so the second project of a
   * session was created within the first, and nothing said so. Which folder that should be is
   * `projectPickerFolder`'s to decide and its own suite's to check; this is the wiring.
   */
  it('starts the dialog where the settings say projects live', async () => {
    const pickPath = vi.fn(() => Promise.resolve(null))
    installFakeBridge({ dialog: { pickPath } })
    const { storage } = useSettings.getState().settings
    // Put back on the way out: this store is module state, and a preference left behind would
    // reach every case below it — including ones written later that never set one.
    onTestFinished(() => {
      useSettings.setState(state => ({ settings: { ...state.settings, storage } }))
    })
    useSettings.setState(state => ({
      settings: {
        ...state.settings,
        storage: { ...storage, projectsFolder: '/Users/someone/Projets' },
      },
    }))

    await useProject.getState().createPicked()

    expect(pickPath).toHaveBeenCalledWith('folder', '/Users/someone/Projets')
  })
})

/**
 * Leaving the project with none in its place — a different gesture from dropping its row, which
 * the section below covers: the shelf keeps the project, and the studio lands back on the home.
 */
describe('closing the open project', () => {
  const OPEN: RecentProject = {
    path: '/projects/Summer',
    openedAt: '2026-08-10T09:00:00.000Z',
  }

  beforeEach(() => {
    useProject.setState({ project: { path: OPEN.path, manifest: MANIFEST }, known: true })
    useSettings.setState(state => ({
      settings: {
        ...state.settings,
        storage: {
          ...state.settings.storage,
          recentProjects: [OPEN],
          lastProject: OPEN.path,
        },
      },
    }))
  })

  /**
   * The two questions in order. Reversed, someone answering for three documents would then be
   * asked whether to close at all — and their three answers would have been for nothing.
   */
  it('asks about the generations before asking about the documents', async () => {
    const askLeave = vi.fn(() => Promise.resolve(false))
    const close = vi.fn(() => Promise.resolve())
    installFakeBridge({ project: { askLeave, close } })

    await expect(useProject.getState().close()).resolves.toBe('kept')

    expect(askLeave).toHaveBeenCalled()
    expect(settleUnsavedWorkForProjectChange).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    expect(useProject.getState().project).not.toBeNull()
  })

  /**
   * `refreshDocuments` drops every open document without unloading anything, so no
   * `beforeunload` ever sees a project leave — `guardUnsavedWork` writes that trou in clear.
   * The question therefore belongs to the gesture, and a no has to leave everything standing.
   */
  it('leaves the project open when the question about unsaved work is cancelled', async () => {
    const close = vi.fn(() => Promise.resolve())
    installFakeBridge({ project: { close } })
    settleUnsavedWorkForProjectChange.mockResolvedValue(false)

    await expect(useProject.getState().close()).resolves.toBe('kept')

    expect(close).not.toHaveBeenCalled()
    expect(useProject.getState().project).not.toBeNull()
  })

  it('asks the main process and leaves the studio with no project', async () => {
    const close = vi.fn(() => Promise.resolve())
    installFakeBridge({ project: { close } })

    await useProject.getState().close()

    expect(close).toHaveBeenCalled()
    expect(useProject.getState().project).toBeNull()
  })

  /**
   * `startup: 'lastProject'` is the default, so a closing that left the pointer behind would be
   * undone by the next launch: the project reopens, and nothing says why. The shelf is NOT
   * touched with it — the row is what the project is reopened from, and that is the whole
   * difference with forgetting one.
   */
  it('clears the startup pointer and leaves the shelf alone', async () => {
    const write = vi.fn(() => Promise.resolve(useSettings.getState().settings))
    installFakeBridge({ settings: { write } })

    await useProject.getState().close()

    expect(write).toHaveBeenCalledWith({ storage: { lastProject: undefined } })
  })

  /**
   * A second window reaches here on the same gesture, after the first one has already closed.
   * Writing the settings then would clear a pointer another project has since claimed.
   */
  it('writes nothing when no project is open', async () => {
    const close = vi.fn(() => Promise.resolve())
    const write = vi.fn(() => Promise.resolve(useSettings.getState().settings))
    useProject.setState({ project: null, known: true })
    installFakeBridge({ project: { close }, settings: { write } })

    await useProject.getState().close()

    expect(close).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })
})

/**
 * The shelf is a list of shortcuts, and dropping one is not a gesture on anyone's disk: the
 * folder stays, and reopening the project puts the row back. That is what makes the home's menu
 * safe to offer with no confirmation behind it.
 */
describe('dropping a project from the shelf', () => {
  const SUMMER: RecentProject = {
    path: '/projects/Summer',
    openedAt: '2026-08-10T09:00:00.000Z',
  }
  const WINTER: RecentProject = {
    path: '/projects/Winter',
    openedAt: '2026-08-09T09:00:00.000Z',
  }

  beforeEach(() => {
    useSettings.setState(state => ({
      settings: {
        ...state.settings,
        storage: {
          ...state.settings.storage,
          recentProjects: [SUMMER, WINTER],
          lastProject: undefined,
        },
      },
    }))
  })

  it('writes the shelf back without the folder it was handed', async () => {
    const write = vi.fn(() => Promise.resolve(useSettings.getState().settings))
    installFakeBridge({ settings: { write } })

    await useProject.getState().forget(SUMMER.path)

    expect(write).toHaveBeenCalledWith({ storage: { recentProjects: [WINTER] } })
  })

  /**
   * `startup: 'lastProject'` is the default, so a removal that left the pointer behind was undone
   * by the next launch: the project reopened, `withRecentProject` put it back at the top, and
   * nothing anywhere said why the row had returned.
   */
  it('clears the startup pointer when it named the folder being dropped', async () => {
    const write = vi.fn(() => Promise.resolve(useSettings.getState().settings))
    useSettings.setState(state => ({
      settings: {
        ...state.settings,
        storage: { ...state.settings.storage, lastProject: SUMMER.path },
      },
    }))
    installFakeBridge({ settings: { write } })

    await useProject.getState().forget(SUMMER.path)

    expect(write).toHaveBeenCalledWith({
      storage: { recentProjects: [WINTER], lastProject: undefined },
    })
  })

  // …and leaves it alone otherwise: dropping one project must not stop another from reopening.
  it('leaves the startup pointer alone when it names another project', async () => {
    const write = vi.fn(() => Promise.resolve(useSettings.getState().settings))
    useSettings.setState(state => ({
      settings: {
        ...state.settings,
        storage: { ...state.settings.storage, lastProject: WINTER.path },
      },
    }))
    installFakeBridge({ settings: { write } })

    await useProject.getState().forget(SUMMER.path)

    expect(write).toHaveBeenCalledWith({ storage: { recentProjects: [WINTER] } })
  })

  // The row says "removes it from this list only". Nothing may reach the folder itself.
  it('touches nothing on the disk', async () => {
    const trashFiles = vi.fn(nothingMoved)
    installFakeBridge({ project: { trashFiles } })

    await useProject.getState().forget(SUMMER.path)

    expect(trashFiles).not.toHaveBeenCalled()
  })

  it('says nothing and does nothing with no bridge to write through', async () => {
    vi.unstubAllGlobals()

    await expect(useProject.getState().forget(SUMMER.path)).resolves.toBeUndefined()
  })

  // The same forgetting, reached from the other side: an opening can fail anywhere, and a list
  // that only forgets when the home asked it keeps offering a folder nothing can open.
  it('forgets a folder that will not open, wherever the click came from', async () => {
    const write = vi.fn(() => Promise.resolve(useSettings.getState().settings))
    installFakeBridge({ settings: { write } })

    await expect(useProject.getState().open(SUMMER.path)).resolves.toBe(false)

    expect(write).toHaveBeenCalledWith({ storage: { recentProjects: [WINTER] } })
  })
})

/**
 * Renaming a project, which is TWO writes that belong together: the manifest, which only the main
 * process can touch, and the `recentProjects` entry, which stores the name rather than deriving it
 * from the folder. Skipping the second lists the project under its old name until it is reopened.
 */
describe('giving a project a new name', () => {
  const SUMMER: RecentProject = {
    path: '/projects/Summer',
    openedAt: '2026-08-10T09:00:00.000Z',
    createdAt: '2026-05-01T09:00:00.000Z',
  }

  const RENAMED = { path: '/projects/Winter', manifest: { ...MANIFEST, name: 'Winter' } }

  beforeEach(() => {
    useSettings.setState(state => ({
      settings: {
        ...state.settings,
        storage: { ...state.settings.storage, recentProjects: [SUMMER] },
      },
    }))
  })

  it('moves the folder, then the shelf entry that points at it', async () => {
    const rename = vi.fn(() => Promise.resolve(RENAMED))
    const write = vi.fn(() => Promise.resolve(useSettings.getState().settings))
    installFakeBridge({ project: { rename }, settings: { write } })

    await expect(useProject.getState().rename(SUMMER.path, 'Winter')).resolves.toMatchObject({
      ok: true,
    })

    expect(rename).toHaveBeenCalledWith(SUMMER.path, 'Winter')
    // 🛑 The PATH moves with the name: an entry left where it was points at a folder that is no
    // longer there, and `projects.list` then answers a path nothing opens.
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        storage: expect.objectContaining({ recentProjects: [{ ...SUMMER, path: RENAMED.path }] }),
      }),
    )
  })

  /** One role override, as `ai.projectRoles` shapes it — the value is not what this case is about. */
  const ROLE_HELD: Partial<Record<AiRoleId, RoleProvider>> = {
    [ASSISTANT_ROLE]: { kind: 'cloud', providerId: 'deepseek' },
  }

  /**
   * 🛑 EVERYTHING keyed by folder moves with it, and the account link above all: orphaned at the
   * old path, `planProjectAccount` answers `adopt` and the project silently comes back on whichever
   * key is active — a destructive write nobody asked for.
   */
  it('moves every table keyed on the folder, not only the shelf', async () => {
    installFakeBridge({ project: { rename: () => Promise.resolve(RENAMED) } })
    const write = vi.fn(async () => {})
    useSettings.setState(state => ({
      write,
      settings: {
        ...state.settings,
        storage: {
          ...state.settings.storage,
          recentProjects: [SUMMER],
          lastProject: SUMMER.path,
          projectAccounts: { [SUMMER.path]: 'account-1' },
        },
        ai: { ...state.settings.ai, projectRoles: { [SUMMER.path]: ROLE_HELD } },
      },
    }))

    await useProject.getState().rename(SUMMER.path, 'Winter')

    expect(write).toHaveBeenCalledWith({
      storage: {
        recentProjects: [{ ...SUMMER, path: RENAMED.path }],
        projectAccounts: { [RENAMED.path]: 'account-1' },
        lastProject: RENAMED.path,
      },
      ai: { projectRoles: { [RENAMED.path]: ROLE_HELD } },
    })
  })

  // The title bar reads the folder. Waiting for the broadcast to come back would leave it
  // naming the old one for a frame.
  it('takes the new name straight away when the renamed project is the open one', async () => {
    installFakeBridge({ project: { rename: () => Promise.resolve(RENAMED) } })
    useProject.setState({ project: { path: SUMMER.path, manifest: MANIFEST }, known: true })

    await useProject.getState().rename(SUMMER.path, 'Winter')

    expect(projectName(useProject.getState().project?.path ?? '')).toBe('Winter')
  })

  // The shelf lists projects that are not open, and renaming one must not put it in front.
  it('leaves the open project alone when another one is renamed', async () => {
    const open = { path: '/projects/other', manifest: MANIFEST }
    installFakeBridge({ project: { rename: () => Promise.resolve(RENAMED) } })
    useProject.setState({ project: open, known: true })

    await useProject.getState().rename(SUMMER.path, 'Winter')

    expect(useProject.getState().project).toBe(open)
  })

  /**
   * The manifest is written FIRST for this reason: a folder gone since the shelf last saw it is the
   * ordinary case there, and the settings must not end up claiming a name the disk refused.
   */
  it('leaves the shelf alone when the disk refused the name', async () => {
    const write = vi.fn(() => Promise.resolve(useSettings.getState().settings))
    installFakeBridge({
      project: { rename: () => Promise.reject(new Error('not a project')) },
      settings: { write },
    })

    await expect(useProject.getState().rename(SUMMER.path, 'Winter')).resolves.toMatchObject({
      ok: false,
      why: expect.stringContaining('not a project'),
    })

    expect(write).not.toHaveBeenCalled()
  })

  // The FOLDER moves in the main process, which owns it. No file gesture of this store's may
  // reach the disk on the way — a rename is not a file operation the undo stack should hold.
  it('moves nothing through the file channels', async () => {
    const renameFile = vi.fn(nothingMoved)
    const trashFiles = vi.fn(nothingMoved)
    installFakeBridge({
      project: { rename: () => Promise.resolve(RENAMED), renameFile, trashFiles },
    })

    await useProject.getState().rename(SUMMER.path, 'Winter')

    expect(renameFile).not.toHaveBeenCalled()
    expect(trashFiles).not.toHaveBeenCalled()
  })

  it('says nothing and does nothing with no bridge to write through', async () => {
    vi.unstubAllGlobals()

    await expect(useProject.getState().rename(SUMMER.path, 'Winter')).resolves.toEqual({
      ok: false,
      why: null,
    })
  })
})

/**
 * 🛑 The gesture `forget` above is NOT. This one bins the folder, and everything keyed on the path
 * it held goes with it: nothing brings a project back once the folder has left.
 */
describe('putting a project folder in the trash', () => {
  const SUMMER: RecentProject = {
    path: '/projects/Summer',
    openedAt: '2026-08-10T09:00:00.000Z',
  }
  const WINTER: RecentProject = {
    path: '/projects/Winter',
    openedAt: '2026-08-09T09:00:00.000Z',
  }
  const ROLE_HELD: Partial<Record<AiRoleId, RoleProvider>> = {
    [ASSISTANT_ROLE]: { kind: 'cloud', providerId: 'deepseek' },
  }

  /** The shelf, the pointer, the account link and the roles — all four keyed on the folder. */
  const binning = (project: BridgeOverrides['project'], lastProject = SUMMER.path) => {
    const write = vi.fn(async () => {})
    installFakeBridge({ project })
    useSettings.setState(state => ({
      write,
      settings: {
        ...state.settings,
        storage: {
          ...state.settings.storage,
          recentProjects: [SUMMER, WINTER],
          lastProject,
          projectAccounts: { [SUMMER.path]: 'account-1', [WINTER.path]: 'account-2' },
        },
        ai: { ...state.settings.ai, projectRoles: { [SUMMER.path]: ROLE_HELD } },
      },
    }))
    return write
  }

  it('drops every table keyed on the folder once the bin has happened', async () => {
    const write = binning({ trash: () => Promise.resolve('trashed') })

    await expect(useProject.getState().trash(SUMMER.path)).resolves.toEqual({
      ok: true,
      trashed: true,
    })

    expect(write).toHaveBeenCalledWith({
      storage: {
        recentProjects: [WINTER],
        lastProject: undefined,
        projectAccounts: { [WINTER.path]: 'account-2' },
      },
      ai: { projectRoles: {} },
    })
  })

  /**
   * 🛑 The one this batch nearly shipped: a folder the disk cannot see right now is an UNPLUGGED
   * DRIVE as much as a deletion. Pruning the account link on that is the silent adoption
   * `storage.projectAccounts` was split out to prevent — plug the drive back in, reopen, and the
   * project comes back on whichever key is active. Only the ROW goes, as a failed opening does.
   */
  it('keeps the account link and the roles when no folder was binned', async () => {
    const write = binning({ trash: () => Promise.resolve('missing') })

    await expect(useProject.getState().trash(SUMMER.path)).resolves.toEqual({
      ok: true,
      trashed: false,
    })

    expect(write).toHaveBeenCalledWith({
      storage: { recentProjects: [WINTER], lastProject: undefined },
    })
  })

  // A folder that is THERE and holds no project: nothing was binned and nothing is written.
  it('writes nothing when the folder holds no project', async () => {
    const write = binning({ trash: () => Promise.resolve('not-a-project') })

    await expect(useProject.getState().trash(SUMMER.path)).resolves.toMatchObject({
      ok: false,
      declined: false,
    })

    expect(write).not.toHaveBeenCalled()
  })

  /**
   * The open project is LEFT through the same door as every other exit, questions and all — and a
   * no there keeps the folder. Told apart from a failure: the person did not fail, they said no.
   */
  it('bins nothing when the question on the way out is answered no', async () => {
    const trash = vi.fn((): Promise<ProjectBinned> => Promise.resolve('trashed'))
    binning({ trash, askLeave: () => Promise.resolve(false) })
    useProject.setState({ project: { path: SUMMER.path, manifest: MANIFEST }, known: true })

    await expect(useProject.getState().trash(SUMMER.path)).resolves.toMatchObject({
      ok: false,
      declined: true,
      why: 'kept',
    })

    expect(trash).not.toHaveBeenCalled()
    expect(useProject.getState().project).not.toBeNull()
  })

  /**
   * 🛑 The project has to be CLOSED before its folder can go — the catalogue holds a file inside
   * it — so a refusal reached a person whose project had been shut for a gesture that never
   * happened, with `lastProject` cleared and nothing anywhere to reopen it.
   */
  it('puts the open project back when nothing was binned', async () => {
    const open = { path: SUMMER.path, manifest: MANIFEST }
    binning({ trash: () => Promise.reject(new Error('EPERM')), open: () => Promise.resolve(open) })
    useProject.setState({ project: open, known: true })

    await expect(useProject.getState().trash(SUMMER.path)).resolves.toMatchObject({ ok: false })

    expect(useProject.getState().project?.path).toBe(SUMMER.path)
  })

  /**
   * The folder still stands, so the shelf must go on naming it: forgetting a project the disk
   * still holds is a project nobody can find again.
   */
  it('leaves the shelf alone when the system refused the folder', async () => {
    const write = binning({ trash: () => Promise.reject(new Error('EPERM')) })

    await expect(useProject.getState().trash(SUMMER.path)).resolves.toEqual({
      ok: false,
      declined: false,
      why: expect.stringContaining('EPERM'),
    })

    expect(write).not.toHaveBeenCalled()
  })
})
