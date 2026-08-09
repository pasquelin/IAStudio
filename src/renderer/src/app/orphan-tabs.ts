import { panelIds, useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { closePanel } from './dockview-api'

/**
 * Closes the tabs of documents nothing can open any more.
 *
 * The layout is persisted and the documents are not, so a tab restored on startup outlives its
 * document: a document created and never saved is in no folder to be read back, and its panel
 * comes back alone, saying it is not open. `refresh` settles which documents live from the
 * folder and the layout, and never the other way round — this closes that loop.
 *
 * Absent from the folder is NOT the condition: a document created during the session is absent
 * from it too, and sweeping on that alone would close a tab under the hands that opened it.
 * Both halves are asked, and the store is read here rather than passed in — an Explorer row
 * adopted while the listing travelled belongs to the answer.
 *
 * Called only when the folder answered: an empty centre left by a failed read looks exactly
 * like a project of ghosts, and closing on it would cost a live arrangement for good.
 */
export function closeOrphanTabs(): void {
  const { documents, stored } = useDocuments.getState()
  const known = new Set(stored.map(document => document.id))
  const orphans = new Set(
    [...panelIds(useLayouts.getState().layouts)].filter(id => !documents[id] && !known.has(id)),
  )
  if (orphans.size === 0) return

  // The stored layout first, for the workspaces Dockview has not mounted — their panels are
  // nowhere else. Closing then takes the tabs off the mounted one, and the layout it writes
  // back on that change is already free of them.
  useLayouts.getState().prune(orphans)
  for (const id of orphans) closePanel(id)
}
