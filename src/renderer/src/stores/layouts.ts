import type { SerializedDockview } from 'dockview-react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_WORKSPACE, type WorkspaceId } from '@shared/domain/workspace'

/** Serialized Dockview layout. Its shape belongs to Dockview; we never read it back. */
export type SerializedLayout = SerializedDockview

type LayoutsState = {
  activeWorkspace: WorkspaceId
  /**
   * Whether the home covers the studio. Session state, never persisted — the home is where a
   * launch starts, and remembering that it was closed two days ago would make the entry point
   * something a user has to find again.
   *
   * Not a seventh `WorkspaceId`: that union drives the tool placements, the document kinds and
   * the native menu, and a workspace that opens no document would be a fiction all three have
   * to guard against.
   */
  home: boolean
  layouts: Partial<Record<WorkspaceId, SerializedLayout>>
  /** The project these layouts arrange. A layout is a set of open documents, so it follows one. */
  projectPath: string | null
  setActiveWorkspace: (workspace: WorkspaceId) => void
  setHome: (home: boolean) => void
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
      home: true,
      layouts: {},
      projectPath: null,
      // The native menu follows this through `useNativeMenu`, which subscribes: what it may
      // offer depends on more than the space, so the space alone is not what gets published.
      // Choosing a space leaves the home: that is what a click on one of them asks for.
      setActiveWorkspace: workspace => set({ activeWorkspace: workspace, home: false }),
      setHome: home => set({ home }),
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
    {
      name: 'scenario-studio:layouts',
      // `home` stays out: see the field. Everything else is arrangement, which is the point.
      partialize: ({ activeWorkspace, layouts, projectPath }) => ({
        activeWorkspace,
        layouts,
        projectPath,
      }),
      // Bumped whenever a stored layout stops being one this build can restore: a major
      // Dockview release, or a `DocumentKind` renamed or dropped — Dockview throws on a layout
      // naming a component it cannot find. Dropped rather than migrated, per the type above.
      version: 1,
      migrate: () => undefined,
    },
  ),
)
