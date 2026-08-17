import { useCallback, useEffect, useState } from 'react'
import { isDocumentFolder, type FolderEntry } from '@shared/domain/folder'
import { getBridge } from '@/services/bridge'

export type FolderChildren = {
  /** The sub-folders of the folder asked for, in the order the disk answered. */
  entries: readonly FolderEntry[]
  /** Whether the read has come back — what tells an empty folder from one still reading. */
  read: boolean
  /** Reads it again: what a folder just made inside it needs to appear. */
  reread: () => void
}

/**
 * What one folder holds, one level and no deeper — the reading a folder BROWSER does, as opposed
 * to the tree walk `useFolderTree` keeps for the Explorer.
 *
 * Sub-folders only, and a document is not one even where it is a folder on disk: an image writes
 * itself as `TOTO.img/`, and nothing may be filed inside another document.
 */
export function useFolderChildren(folder: string): FolderChildren {
  const [held, setHeld] = useState<{ folder: string; entries: readonly FolderEntry[] } | null>(null)

  const reread = useCallback(() => {
    void (async () => {
      // A folder taken away under an open field answers nothing, and the list shows empty rather
      // than throwing: what is drawn is what was read.
      const entries = await getBridge()
        ?.project.listFolder(folder, false)
        .catch(() => [])

      setHeld({
        folder,
        entries: (entries ?? []).filter(
          entry => entry.kind === 'folder' && !isDocumentFolder(entry.path),
        ),
      })
    })()
  }, [folder])

  useEffect(reread, [reread])

  // Held against the folder it was read FOR: walking into a folder must not show what the one
  // before it held for the frame it takes to answer.
  return {
    entries: held?.folder === folder ? held.entries : [],
    read: held?.folder === folder,
    reread,
  }
}
