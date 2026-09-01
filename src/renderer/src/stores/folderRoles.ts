import { orElse } from '@shared/promises'
import { documentFolderOf, roleForKind, type DocumentKind } from '@shared/domain/document'
import type { RoleFolders } from '@shared/domain/folderRole'
import { create } from 'zustand'
import { connectThroughBridge } from '@/services/bridge'

type FolderRolesState = {
  /**
   * For DRAWING, never for deciding where to write — `folderFor` is what a write asks. A store of
   * its own because the project's reaches half the application, and the import would close a cycle.
   */
  roles: RoleFolders
  /** Follows the open project's roles. Returns the unsubscribe function. */
  connect: () => Promise<() => void>
}

export const useFolderRoles = create<FolderRolesState>()(set => ({
  roles: {},

  connect: connectThroughBridge(async bridge => {
    const stop = bridge.project.onFolderRoles(roles => set({ roles }))

    // Asked once beside the announcement, which only fires on a CHANGE: a window opened while a
    // project already is would otherwise hold an empty map for the rest of the session.
    set({ roles: await orElse(bridge.project.folderRoles(), {}) })
    return stop
  }),
}))

/**
 * Where documents of a kind START in the OPEN project, falling back to the default layout.
 *
 * For drawing and for naming, never for deciding where to write: `project.folderFor` is what a
 * write asks, and it is the gesture that lays the folder back down when it has been removed.
 */
export const roleFolderOf = (state: FolderRolesState, kind: DocumentKind): string =>
  state.roles[roleForKind(kind)] ?? documentFolderOf(kind)
