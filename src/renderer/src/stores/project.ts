import i18next from 'i18next'
import { create } from 'zustand'
import { withoutRecentProject, type Project } from '@shared/domain/project'
import type { StudioBridge } from '@shared/ipc'
import { refreshDocuments } from '@/app/document-io'
import { closeOrphanTabs } from '@/app/orphan-tabs'
import { getBridge } from '@/services/bridge'
import { forgetReportedFailures } from '@/services/diagnostics'
import { useSettings } from './settings'
import { useActivity } from './activity'
import { useAssets } from './assets'
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
   * Opens a known folder — what the home's shelf of recent projects clicks through to. Answers
   * whether it worked: a folder moved or deleted since it was last opened is the ordinary case
   * for that shelf, and the entry has to go rather than fail again on the next click.
   */
  open: (path: string) => Promise<boolean>
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
  from: (bridge: StudioBridge, folder: string) => Promise<Project>,
): Promise<Project | null> {
  const bridge = getBridge()
  const folder = await bridge?.dialog.pickPath(
    'folder',
    useSettings.getState().settings.storage.projectsFolder,
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
export const useProject = create<ProjectState>()(set => ({
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
      set({ project, known: true })
      void followProject(project)
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

    try {
      set({ project: await bridge.project.open(path), known: true })
      return true
    } catch {
      // Forgotten here rather than by whoever clicked: an opening can fail from anywhere, and a
      // list that only forgets when the home asked it keeps offering a folder nothing can open.
      const recent = useSettings.getState().settings.storage.recentProjects
      await bridge.settings.write({
        storage: { recentProjects: withoutRecentProject(recent, path) },
      })
      return false
    }
  },

  openPicked: async () => {
    const picked = await pickedProject((bridge, folder) => bridge.project.open(folder))
    if (picked) set({ project: picked, known: true })
  },

  createPicked: async () => {
    const picked = await pickedProject((bridge, folder) =>
      // The dialog picks where, not what to call it; renaming a project folder is the file
      // manager's job until the studio has a proper new-project sheet.
      bridge.project.create(folder, i18next.t('project.defaultName')),
    )
    if (picked) set({ project: picked, known: true })
  },
}))
