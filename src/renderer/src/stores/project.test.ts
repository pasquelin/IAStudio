import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecentProject } from '@shared/domain/project'
import { installFakeBridge } from '@/services/fake-bridge'
import { useProject } from './project'
import { useSettings } from './settings'

const closeOrphanTabs = vi.hoisted(() => vi.fn())
vi.mock('@/app/orphan-tabs', () => ({ closeOrphanTabs }))

const MANIFEST = { version: 1, name: 'demo', createdAt: '', updatedAt: '' }

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

  it('creates a project in the folder that was picked', async () => {
    const create = vi.fn(() => Promise.resolve({ path: '/p/new', manifest: MANIFEST }))
    installFakeBridge({ ...picking('/p'), project: { create } })

    await useProject.getState().createPicked()

    expect(create).toHaveBeenCalled()
    expect(useProject.getState().project?.path).toBe('/p/new')
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
        storage: { ...state.settings.storage, recentProjects: [SUMMER, WINTER] },
      },
    }))
  })

  it('writes the shelf back without the folder it was handed', async () => {
    const write = vi.fn(() => Promise.resolve(useSettings.getState().settings))
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
