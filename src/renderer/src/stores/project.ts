import { create } from 'zustand'
import {
  projectPickerFolder,
  renamedRecentProject,
  withoutRecentProject,
  type Project,
} from '@shared/domain/project'
import type { StudioBridge } from '@shared/ipc'
import { refreshDocuments } from '@/app/document-io'
import { closeOrphanTabs } from '@/app/orphan-tabs'
import { getBridge } from '@/services/bridge'
import { forgetReportedFailures } from '@/services/diagnostics'
import { useSettings } from './settings'
import { useActivity } from './activity'
import { forgetRememberedAssets, useAssets } from './assets'
import { useLayouts } from './layouts'
import { useSceneClipboard } from './scene-clipboard'

type ProjectState = {
  project: Project | null
  /**
   * False until the main process has said which project is open, if any. The initial `null` is
   * "not asked yet", not "none" — and the studio reopens the last project on launch, so a
   * surface that took it for an answer would offer to create a project to someone who has one.
   */
  known: boolean

  /** Loads the open project and keeps following it. Returns the unsubscribe function. */
  connect: () => Promise<() => void>
  openPicked: () => Promise<void>
  createPicked: () => Promise<void>
  /**
   * Opens a known folder — what the home's shelf of recent projects and the title bar's menu
   * click through to. Answers whether it worked: a folder moved or deleted since it was last
   * opened is the ordinary case for that shelf, and the entry has to go rather than fail again
   * on the next click.
   *
   * The folder already open is answered `true` without being reopened. Here rather than in
   * whichever surface noticed, for the same reason the forgetting below is: both lists offer the
   * open project as a row, and reopening it tears down every panel's state and reloads the
   * catalogue to land on the folder already in front.
   */
  open: (path: string) => Promise<boolean>
  /**
   * Drops a folder from the shelf of recent projects. The folder itself is untouched: this is a
   * list of shortcuts, and forgetting one is not a gesture on someone's disk.
   *
   * Reopening the project puts it back, which is what makes the row's menu safe to offer without
   * a confirmation.
   */
  forget: (path: string) => Promise<void>
  /**
   * Gives a project a new name — the one in its manifest, never its folder on disk.
   *
   * Two writes, and they belong together: the main process owns the manifest, and this owns the
   * `recentProjects` entry, which stores the name rather than deriving it from the folder. Skipping
   * the second would list the project under its old name until it was next opened.
   *
   * Here rather than in the row that offered it, for the same reason the forgetting above is: two
   * surfaces list projects, and a rename wired into one of them would be missing from the other.
   *
   * Answers whether it happened. The folder can have gone since the shelf last saw it, which is
   * why the manifest is written FIRST: the settings must not claim a name the disk refused.
   */
  rename: (path: string, name: string) => Promise<boolean>
}

/**
 * What follows the project, in order: the arrangement first, since dropping the layouts of
 * another project is what tells the documents which tabs are still open.
 */
async function followProject(project: Project | null): Promise<void> {
  useLayouts.getState().adopt(project?.path ?? null)
  // A copied model names an asset of the project it came from: pasted into another one, it
  // would list in the outliner and draw nothing, with no way to tell why.
  useSceneClipboard.setState({ nodes: [] })
  // Another project's assets are another story: a file that failed to load in the last one has
  // nothing to say about this one, and a failure here is news again.
  forgetReportedFailures()
  // The journal lives in the project's own catalogue, so it is another project's account of
  // itself: left alone, its lines and its failure count would carry over into this one. The
  // toasts too — they never expire, so one raised by the project being left would hang over
  // the one being opened, naming an asset that is no longer anywhere.
  useActivity.getState().dismissAll()
  const [, folderAnswered] = await Promise.all([
    useAssets.getState().refresh(),
    refreshDocuments(),
    useActivity.getState().reload(),
  ])

  // AFTER the catalogue has been read, never before it: the by-id index remembers every asset it
  // has been shown — so that a browsing facet cannot take the names off an open montage — and
  // until `refresh` answers, `items` still holds the rows of the project being left. Forgetting
  // first leaves any render in that window putting them straight back, for the session's life.
  forgetRememberedAssets()

  // Last, and only on a folder that answered: the reconciliation above is what says which tabs
  // have a document, and a listing that failed says nothing about any of them.
  if (folderAnswered) closeOrphanTabs()
}

/**
 * A folder chosen in the dialog, turned into a project — or `null` for each of the three ways
 * that does not happen: no bridge, a cancelled dialog, a folder the main process refused.
 *
 * The refusal is swallowed rather than raised: every caller of the two gestures below does
 * `void openPicked()`, so a rejection left to travel was an unhandled one, and the main
 * process has already written the reason in the journal on its way past. Nothing to undo
 * either — the project that was open is still the one that is open.
 */
async function pickedProject(
  from: (bridge: StudioBridge, folder: string) => Promise<Project | null>,
): Promise<Project | null> {
  const bridge = getBridge()
  const { projectsFolder, recentProjects } = useSettings.getState().settings.storage
  const folder = await bridge?.dialog.pickPath(
    'folder',
    projectPickerFolder(projectsFolder, recentProjects),
  )
  if (!bridge || !folder) return null

  try {
    return await from(bridge, folder)
  } catch {
    return null
  }
}

/**
 * The open project is owned by the main process; this is the renderer's replica, refreshed by
 * broadcast so every window agrees on which project is open.
 */
export const useProject = create<ProjectState>()((set, get) => ({
  project: null,
  known: false,

  connect: async () => {
    const bridge = getBridge()
    // Nothing will ever answer, so the answer is "none": surfaces that wait to be told — the
    // home draws nothing until then — would otherwise wait for the rest of the session.
    if (!bridge) {
      set({ known: true })
      return () => {}
    }

    // The main process reopens the last project on launch without waiting for it, so the answer
    // to `current()` can be the `null` of a moment already gone by the time it arrives. An
    // announcement wins over it, always: it is the later truth, and taking the stale `null`
    // dropped the persisted arrangement of a project that was in fact open.
    let announced = false

    // Another project means another catalogue, another folder of documents, and another
    // arrangement: nothing of the previous one may be left showing.
    const stop = bridge.project.onChange(project => {
      announced = true
      const before = get().project?.path
      set({ project, known: true })

      /**
       * Only when ANOTHER project is in front. The same folder announcing itself again is a
       * manifest that changed under it — a rename is the one that does — and following that would
       * empty the scene clipboard, dismiss every toast and refetch three lists in every window,
       * to update a word. The main process already declines to fire its own `onChange` for a
       * rename (`main/project/store.ts`); this is the same decision on the side that pays for it.
       */
      if (project?.path !== before) void followProject(project)
    })

    // A refusal is an answer too. Left to throw, `connect` never hands back the unsubscribe —
    // stranding the listener — and never says which project is open, which the home reads as
    // "still asking" and holds a blank page on.
    const current = await bridge.project.current().catch(() => null)
    if (announced) return stop

    set({ project: current, known: true })
    await followProject(current)
    return stop
  },

  open: async path => {
    const bridge = getBridge()
    if (!bridge) return false
    // Already in front: the tick on the row said so, and choosing it means "yes, still".
    if (path === get().project?.path) return true

    try {
      set({ project: await bridge.project.open(path), known: true })
      return true
    } catch {
      // Forgotten here rather than by whoever clicked: an opening can fail from anywhere, and a
      // list that only forgets when the home asked it keeps offering a folder nothing can open.
      // Swallowed on the way: this is already the failing path, and `open` answers `false`
      // whether or not the shelf could be written.
      await get()
        .forget(path)
        .catch(() => {})
      return false
    }
  },

  forget: async path => {
    const { settings, write } = useSettings.getState()

    await write({
      storage: {
        recentProjects: withoutRecentProject(settings.storage.recentProjects, path),
        // Cleared with it when it named this folder: `startup: 'lastProject'` is the default, so
        // the next launch would reopen the project, record it through `withRecentProject`, and
        // put the row the user just removed back at the top without a word.
        ...(settings.storage.lastProject === path ? { lastProject: undefined } : {}),
      },
    })
  },

  rename: async (path, name) => {
    const bridge = getBridge()
    if (!bridge) return false

    let renamed: Project
    try {
      renamed = await bridge.project.rename(path, name)
    } catch {
      // Already in the journal, put there by the handler: this answers the caller and stops. The
      // settings are deliberately left alone — a name the disk refused must not be listed.
      return false
    }

    // Only when it is the open one. The broadcast the handler sends reaches the OTHER windows;
    // this one is already past it, and waiting for a round trip would leave the title bar naming
    // the old name for a frame.
    if (get().project?.path === path) set({ project: renamed })

    const { settings, write } = useSettings.getState()
    await write({
      storage: {
        // The name the MANIFEST took, not the one that was asked for: the main process trims it
        // (`parseProjectTitle`), and the shelf storing what was typed would list a project under
        // a name its own manifest does not carry.
        recentProjects: renamedRecentProject(
          settings.storage.recentProjects,
          path,
          renamed.manifest.name,
        ),
      },
    })

    return true
  },

  openPicked: async () => {
    const picked = await pickedProject((bridge, folder) => bridge.project.open(folder))
    if (picked) set({ project: picked, known: true })
  },

  createPicked: async () => {
    // The folder chosen IS the project, and it names itself. What the main process makes of it —
    // a fresh project, the one already there, or a refusal — is its call, not the window's.
    const picked = await pickedProject((bridge, folder) => bridge.project.create(folder))
    if (picked) set({ project: picked, known: true })
  },
}))
