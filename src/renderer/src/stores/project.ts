import i18next from 'i18next'
import { create } from 'zustand'
import type { Project } from '@shared/domain/project'
import { getBridge } from '@/services/bridge'
import { useAssets } from './assets'

type ProjectState = {
  project: Project | null

  /** Loads the open project and keeps following it. Returns the unsubscribe function. */
  connect: () => Promise<() => void>
  openPicked: () => Promise<void>
  createPicked: () => Promise<void>
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

    const stop = bridge.project.onChange(project => {
      set({ project })
      // Another project means another catalogue: the browser must not keep showing the
      // previous one's assets.
      void useAssets.getState().refresh()
    })

    set({ project: await bridge.project.current() })
    await useAssets.getState().refresh()
    return stop
  },

  openPicked: async () => {
    const bridge = getBridge()
    const folder = await bridge?.project.pickFolder()
    if (bridge && folder) set({ project: await bridge.project.open(folder) })
  },

  createPicked: async () => {
    const bridge = getBridge()
    const folder = await bridge?.project.pickFolder()
    if (!bridge || !folder) return

    // The dialog picks where, not what to call it; renaming a project folder is the file
    // manager's job until the studio has a proper new-project sheet.
    const name = i18next.t('project.defaultName')
    set({ project: await bridge.project.create(folder, name) })
  },
}))
