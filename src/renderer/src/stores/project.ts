import i18next from 'i18next'
import { create } from 'zustand'
import type { Project } from '@shared/domain/project'
import { getBridge } from '@/services/bridge'
import { forgetReportedFailures } from '@/services/diagnostics'
import { useSettings } from './settings'
import { useActivity } from './activity'
import { useAssets } from './assets'
import { useDocuments } from './documents'
import { useLayouts } from './layouts'
import { useSceneClipboard } from './scene-clipboard'

type ProjectState = {
  project: Project | null

  /** Loads the open project and keeps following it. Returns the unsubscribe function. */
  connect: () => Promise<() => void>
  openPicked: () => Promise<void>
  createPicked: () => Promise<void>
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
  await Promise.all([
    useAssets.getState().refresh(),
    useDocuments.getState().refresh(),
    useActivity.getState().reload(),
  ])
}

/**
 * The open project is owned by the main process; this is the renderer's replica, refreshed by
 * broadcast so every window agrees on which project is open.
 */
export const useProject = create<ProjectState>()(set => ({
  project: null,

  connect: async () => {
    const bridge = getBridge()
    if (!bridge) return () => {}

    // The main process reopens the last project on launch without waiting for it, so the answer
    // to `current()` can be the `null` of a moment already gone by the time it arrives. An
    // announcement wins over it, always: it is the later truth, and taking the stale `null`
    // dropped the persisted arrangement of a project that was in fact open.
    let announced = false

    // Another project means another catalogue, another folder of documents, and another
    // arrangement: nothing of the previous one may be left showing.
    const stop = bridge.project.onChange(project => {
      announced = true
      set({ project })
      void followProject(project)
    })

    const current = await bridge.project.current()
    if (announced) return stop

    set({ project: current })
    await followProject(current)
    return stop
  },

  openPicked: async () => {
    const bridge = getBridge()
    const folder = await bridge?.dialog.pickPath(
      'folder',
      useSettings.getState().settings.storage.projectsFolder,
    )
    if (bridge && folder) set({ project: await bridge.project.open(folder) })
  },

  createPicked: async () => {
    const bridge = getBridge()
    const folder = await bridge?.dialog.pickPath(
      'folder',
      useSettings.getState().settings.storage.projectsFolder,
    )
    if (!bridge || !folder) return

    // The dialog picks where, not what to call it; renaming a project folder is the file
    // manager's job until the studio has a proper new-project sheet.
    const name = i18next.t('project.defaultName')
    set({ project: await bridge.project.create(folder, name) })
  },
}))
