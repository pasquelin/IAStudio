import type { SerializedDockview } from 'dockview-react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_WORKSPACE, WORKSPACE_IDS, type WorkspaceId } from '@shared/domain/workspace'
import { HOME_SURFACE, type ToolSurface } from '@shared/domain/tool'
import { withoutPanels } from './layout-prune'
import { useSettings } from './settings'

/**
 * Serialized Dockview layout. Its shape belongs to Dockview, and only two things read it back:
 * `panelIds`, which asks which documents are open, and `prune`, which takes one out.
 */
export type SerializedLayout = SerializedDockview

type LayoutsState = {
  activeWorkspace: WorkspaceId
  /**
   * Whether the home covers the studio. Session state, never persisted — the home is where a
   * launch starts, and remembering that it was closed two days ago would make the entry point
   * something a user has to find again.
   *
   * Not a `WorkspaceId` of its own: that union drives the tool placements, the document kinds and
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
  /**
   * Takes those panels out of every workspace's layout — the tabs of documents the window can
   * no longer open. A layout left with none is forgotten rather than kept as an empty one.
   */
  prune: (panels: ReadonlySet<string>) => void
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

      prune: panels =>
        set(state => {
          const layouts = { ...state.layouts }
          let pruned = false

          for (const workspace of WORKSPACE_IDS) {
            const layout = layouts[workspace]
            // Asked before rewriting: `withoutPanels` always answers with a new object, and a
            // layout replaced by an equal one is a write to `localStorage` per launch.
            if (!layout || !Object.keys(layout.panels).some(id => panels.has(id))) continue

            pruned = true
            const kept = withoutPanels(layout, panels)
            if (kept) layouts[workspace] = kept
            else delete layouts[workspace]
          }

          return pruned ? { layouts } : {}
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
      //
      // 2: the graph space went, and `activeWorkspace` is persisted. Restored verbatim, a
      // session last left in it hands `'graph'` to `workspaceById`, which throws on an id no
      // build declares — during render, in the shell, the generator and the models panel alike.
      version: 2,
      migrate: () => undefined,
    },
  ),
)

/**
 * Whether the home is the surface in front: the session flag AND the setting that allows it.
 *
 * One answer, in one place, because three readers ask — the shell, the title bar and the native
 * menu — and they were each combining the two halves themselves. The menu had stopped: `home`
 * starts `true` on every launch, so a studio whose home is turned off published its menu as if
 * the home were up, while the docks were on screen.
 */
export function homeIsVisible(): boolean {
  return useLayouts.getState().home && useSettings.getState().settings.home.enabled
}

/** The same answer, subscribed. */
export function useHomeVisible(): boolean {
  const home = useLayouts(state => state.home)
  const enabled = useSettings(state => state.settings.home.enabled)
  return home && enabled
}

/**
 * Which surface the panels answer to. Every question about what may be open — the rails, the
 * zones, the native menu — asks this rather than the workspace: the home carries panels of its
 * own, and reading `activeWorkspace` there would offer the ones of the space behind it.
 */
export function toolSurface(): ToolSurface {
  return homeIsVisible() ? HOME_SURFACE : useLayouts.getState().activeWorkspace
}

/** The same answer, subscribed. */
export function useToolSurface(): ToolSurface {
  const home = useHomeVisible()
  const workspace = useLayouts(state => state.activeWorkspace)
  return home ? HOME_SURFACE : workspace
}
