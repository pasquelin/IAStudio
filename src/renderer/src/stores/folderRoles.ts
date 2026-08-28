import { orElse } from '@shared/promises'
import type { RoleFolders } from '@shared/domain/folderRole'
import { create } from 'zustand'
import { getBridge } from '@/services/bridge'

type FolderRolesState = {
  /**
   * Where each role's folder sits in the open project — PARTIAL, a role whose folder is gone
   * being absent rather than pointed at its default. `{}` while no project is open.
   *
   * A store of its own rather than a field of the project's, and it is not tidiness: every store
   * that composes a path needs this, and the project store reaches half the application through
   * `followProject` — the import would close a cycle `import-cycles.test.ts` holds at zero.
   */
  roles: RoleFolders
  /** Follows the open project's roles. Returns the unsubscribe function. */
  connect: () => Promise<() => void>
}

export const useFolderRoles = create<FolderRolesState>()(set => ({
  roles: {},

  connect: async () => {
    const bridge = getBridge()
    if (!bridge) return () => {}

    const stop = bridge.project.onFolderRoles(roles => set({ roles }))

    // Asked once beside the announcement, which only fires on a CHANGE: a window opened while a
    // project already is would otherwise hold an empty map for the rest of the session.
    set({ roles: await orElse(bridge.project.folderRoles(), {}) })
    return stop
  },
}))

/**
 * The map, for a caller outside React — where a document lands is decided in a store and in a
 * command, neither of which renders.
 */
export function folderRoles(): RoleFolders {
  return useFolderRoles.getState().roles
}
