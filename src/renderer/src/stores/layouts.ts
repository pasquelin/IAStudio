import type { SerializedDockview } from 'dockview-react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_WORKSPACE, type WorkspaceId } from '@shared/domain/workspace'
import { getBridge } from '@/services/bridge'

/** Serialized Dockview layout. Its shape belongs to Dockview; we never read it back. */
export type SerializedLayout = SerializedDockview

type LayoutsState = {
  activeWorkspace: WorkspaceId
  layouts: Partial<Record<WorkspaceId, SerializedLayout>>
  /** The project these layouts arrange. A layout is a set of open documents, so it follows one. */
  projectPath: string | null
  setActiveWorkspace: (workspace: WorkspaceId) => void
  remember: (workspace: WorkspaceId, layout: SerializedLayout) => void
  forget: (workspace: WorkspaceId) => void
  /** Keeps the arrangement when the same project comes back, drops it for another one. */
  adopt: (projectPath: string | null) => void
}

/**
 * Every workspace keeps ITS OWN layout: coming back to "3D" must restore the viewport and the
 * outliner as they were, not the "Image" layout.
 *
 * And every layout belongs to ONE project: a panel is a document open, and the documents live
 * in the project folder. Kept across a change of project, the tabs of the previous one came
 * back over a folder that has none of them.
 */
export const useLayouts = create<LayoutsState>()(
  persist(
    set => ({
      activeWorkspace: DEFAULT_WORKSPACE,
      layouts: {},
      projectPath: null,
      setActiveWorkspace: workspace => {
        set({ activeWorkspace: workspace })
        // The native menu shows what the active space can do; nothing else tells the main
        // process which one that is.
        void getBridge()?.window.setWorkspace(workspace)
      },
      remember: (workspace, layout) =>
        set(state => ({ layouts: { ...state.layouts, [workspace]: layout } })),
      forget: workspace =>
        set(state => {
          const remaining = { ...state.layouts }
          delete remaining[workspace]
          return { layouts: remaining }
        }),

      adopt: projectPath =>
        set(state => (state.projectPath === projectPath ? {} : { projectPath, layouts: {} })),
    }),
    { name: 'scenario-studio:layouts' },
  ),
)
