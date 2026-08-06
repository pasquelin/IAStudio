import type { SerializedDockview } from 'dockview-react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_WORKSPACE, type WorkspaceId } from '@/app/workspaces'

/** Disposition Dockview sérialisée. Sa forme appartient à Dockview, on ne la relit pas. */
export type SerializedLayout = SerializedDockview

type LayoutsState = {
  activeWorkspace: WorkspaceId
  layouts: Partial<Record<WorkspaceId, SerializedLayout>>
  setActiveWorkspace: (workspace: WorkspaceId) => void
  remember: (workspace: WorkspaceId, layout: SerializedLayout) => void
  forget: (workspace: WorkspaceId) => void
}

/**
 * Chaque espace garde SA disposition : revenir sur « 3D » doit retrouver le viewport et
 * l'outliner tels qu'ils étaient, pas la disposition de « Image ».
 */
export const useLayouts = create<LayoutsState>()(
  persist(
    set => ({
      activeWorkspace: DEFAULT_WORKSPACE,
      layouts: {},
      setActiveWorkspace: workspace => set({ activeWorkspace: workspace }),
      remember: (workspace, layout) =>
        set(state => ({ layouts: { ...state.layouts, [workspace]: layout } })),
      forget: workspace =>
        set(state => {
          const remaining = { ...state.layouts }
          delete remaining[workspace]
          return { layouts: remaining }
        }),
    }),
    { name: 'scenario-studio:layouts' },
  ),
)
