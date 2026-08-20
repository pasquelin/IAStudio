import { useCallback, useEffect, useMemo, useState } from 'react'
import { folderTrail, type FolderEntry } from '@shared/domain/folder'
import { getBridge } from '@/services/bridge'

/** One column: the folder it stands for, and the sub-folders it holds. */
export type FolderColumn = { folder: string; entries: readonly FolderEntry[]; read: boolean }

export type FolderColumns = {
  /** The project folder first, then one per level down to the chosen folder. */
  columns: readonly FolderColumn[]
  /** Reads a folder again — what a folder just made inside it needs to appear. */
  reread: (folder: string) => void
}

/**
 * The project read as a column browser: one column per level of the walk down to `chosen`, each
 * holding what that folder holds.
 *
 * The walk IS the state — there is nothing else to keep. Choosing a folder shortens or lengthens
 * it, and the columns follow; picking a folder higher up drops every column past it, which is
 * exactly what the Finder does.
 *
 * Sub-folders only, and a document is not one even where it is a folder on disk: an image writes
 * itself as `TOTO.img/`, and nothing may be filed inside another document.
 */
export function useFolderColumns(chosen: string): FolderColumns {
  const [held, setHeld] = useState<Record<string, readonly FolderEntry[]>>({})

  const reread = useCallback((folder: string) => {
    void (async () => {
      // A folder taken away under an open picker answers nothing, and its column shows empty
      // rather than throwing: what is drawn is what was read.
      const entries = await getBridge()
        ?.project.listFolder(folder, false)
        .catch(() => [])

      setHeld(before => ({
        ...before,
        [folder]: (entries ?? []).filter(entry => entry.kind === 'folder'),
      }))
    })()
  }, [])

  const trail = useMemo(() => folderTrail(chosen), [chosen])

  useEffect(() => {
    for (const folder of trail) reread(folder)
  }, [trail, reread])

  return {
    columns: trail.map(folder => ({
      folder,
      entries: held[folder] ?? [],
      // Told apart from an empty folder: a column still reading and one holding nothing look
      // alike, and only the second has anything to say.
      read: held[folder] !== undefined,
    })),
    reread,
  }
}
