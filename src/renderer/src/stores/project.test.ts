import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, RecentProject } from '@shared/domain/project'
import { installFakeBridge } from '@/services/fake-bridge'
import type { ActivityEntry } from '@shared/domain/activity'
import { useActivity } from './activity'
import { assetsById, useAssets } from './assets'
import { useProject } from './project'
import { useSettings } from './settings'

const closeOrphanTabs = vi.hoisted(() => vi.fn())
vi.mock('@/app/orphan-tabs', () => ({ closeOrphanTabs }))

const MANIFEST = { version: 1, name: 'demo', createdAt: '', updatedAt: '' }

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
  it('follows another project, and lets the same one merely change its name', async () => {
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
    announce({ path: '/projects/summer', manifest: MANIFEST })

    expect(useActivity.getState().unread).toEqual([])

    useActivity.setState({ unread: [TOAST] })
    announce({ path: '/projects/summer', manifest: { ...MANIFEST, name: 'Winter' } })

    expect(useActivity.getState().unread).toEqual([TOAST])
    expect(useProject.getState().project?.manifest.name).toBe('Winter')
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

    listeners.forEach(listener => listener({ path: '/projects/winter', manifest: MANIFEST }))
    // The index read while the new catalogue is still being fetched, which is what a panel
    // rendering in that window does — and what used to put the old rows back for good.
    assetsById(useAssets.getState())

    await vi.waitFor(() => expect(assetsById(useAssets.getState()).get('a')).toBeUndefined())
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
   * session was created within the first, and nothing said so.
   */
  describe('the folder the dialog starts in', () => {
    const startingIn = () => {
      const pickPath = vi.fn(() => Promise.resolve(null))
      installFakeBridge({ dialog: { pickPath } })
      return pickPath
    }

    const storedAs = (storage: { projectsFolder?: string; lastProjectsFolder?: string }) => {
      useSettings.setState(state => ({
        settings: { ...state.settings, storage: { ...state.settings.storage, ...storage } },
      }))
    }

    it('is the preference when the user set one', async () => {
      storedAs({ projectsFolder: '/Users/someone/Projets', lastProjectsFolder: '/elsewhere' })
      const pickPath = startingIn()

      await useProject.getState().createPicked()

      expect(pickPath).toHaveBeenCalledWith('folder', '/Users/someone/Projets')
    })

    // The preference is deliberately left empty by people who want the dialog to follow them;
    // this is what "follow them" means, and it is remembered rather than left to the system.
    it('falls back to where the last project was made', async () => {
      storedAs({ projectsFolder: undefined, lastProjectsFolder: '/Users/someone/Mes Projets' })
      const pickPath = startingIn()

      await useProject.getState().createPicked()

      expect(pickPath).toHaveBeenCalledWith('folder', '/Users/someone/Mes Projets')
    })
  })
})

/**
 * The shelf is a list of shortcuts, and dropping one is not a gesture on anyone's disk: the
 * folder stays, and reopening the project puts the row back. That is what makes the home's menu
 * safe to offer with no confirmation behind it.
 */
describe('dropping a project from the shelf', () => {
  const SUMMER: RecentProject = {
    path: '/projects/summer',
    name: 'Summer',
    openedAt: '2026-08-10T09:00:00.000Z',
  }
  const WINTER: RecentProject = {
    path: '/projects/winter',
    name: 'Winter',
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
    const trashFile = vi.fn(() => Promise.resolve(true))
    installFakeBridge({ project: { trashFile } })

    await useProject.getState().forget(SUMMER.path)

    expect(trashFile).not.toHaveBeenCalled()
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
    path: '/projects/summer',
    name: 'Summer',
    openedAt: '2026-08-10T09:00:00.000Z',
    createdAt: '2026-05-01T09:00:00.000Z',
  }

  const RENAMED = { path: SUMMER.path, manifest: { ...MANIFEST, name: 'Winter' } }

  beforeEach(() => {
    useSettings.setState(state => ({
      settings: {
        ...state.settings,
        storage: { ...state.settings.storage, recentProjects: [SUMMER] },
      },
    }))
  })

  it('writes the manifest, then the shelf entry that carries the name', async () => {
    const rename = vi.fn(() => Promise.resolve(RENAMED))
    const write = vi.fn(() => Promise.resolve(useSettings.getState().settings))
    installFakeBridge({ project: { rename }, settings: { write } })

    await expect(useProject.getState().rename(SUMMER.path, 'Winter')).resolves.toBe(true)

    expect(rename).toHaveBeenCalledWith(SUMMER.path, 'Winter')
    expect(write).toHaveBeenCalledWith({
      storage: { recentProjects: [{ ...SUMMER, name: 'Winter' }] },
    })
  })

  // The title bar reads `project.manifest.name`. Waiting for the broadcast to come back would
  // leave it naming the old name for a frame.
  it('takes the new name straight away when the renamed project is the open one', async () => {
    installFakeBridge({ project: { rename: () => Promise.resolve(RENAMED) } })
    useProject.setState({ project: { path: SUMMER.path, manifest: MANIFEST }, known: true })

    await useProject.getState().rename(SUMMER.path, 'Winter')

    expect(useProject.getState().project?.manifest.name).toBe('Winter')
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

    await expect(useProject.getState().rename(SUMMER.path, 'Winter')).resolves.toBe(false)

    expect(write).not.toHaveBeenCalled()
  })

  // The row says the folder is left where it is. Nothing here may reach it.
  it('touches nothing on the disk', async () => {
    const renameFile = vi.fn(() => Promise.resolve(true))
    const trashFile = vi.fn(() => Promise.resolve(true))
    installFakeBridge({
      project: { rename: () => Promise.resolve(RENAMED), renameFile, trashFile },
    })

    await useProject.getState().rename(SUMMER.path, 'Winter')

    expect(renameFile).not.toHaveBeenCalled()
    expect(trashFile).not.toHaveBeenCalled()
  })

  it('says nothing and does nothing with no bridge to write through', async () => {
    vi.unstubAllGlobals()

    await expect(useProject.getState().rename(SUMMER.path, 'Winter')).resolves.toBe(false)
  })
})
