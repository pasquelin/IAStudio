import { activeSceneId, useDocuments } from './documents'
import { sceneOf, useScenes } from './scenes'
import { useSelection } from './selection'

/**
 * Points the inspector at a scene whenever that scene changes what it has selected — and NOT only
 * when a pointer did it.
 *
 * `selectIn` is one of the doors; the commands are the others, and they are the ones nobody thinks
 * of. An import selects the model it just put down (`addNodes`), a duplicate its copies, a delete
 * drops what it removed, ⌘Z puts both back. Dropping an asset in the viewport therefore left the
 * panel describing the ASSET while the outliner highlighted the NODE it had become — the same
 * thing named twice, and a second click on the row as the only way out.
 *
 * Subscribed rather than called from each site: nine of them run a scene command, and the one that
 * forgot would bring the defect back with nothing to say so.
 *
 * A connector, like the five others the application wires up, rather than a subscription taken at
 * import: it can be undone, tests can install it or leave it alone, and the fixtures that put a
 * scene in place do not silently drag it along.
 */
export function connectSceneSelection(): () => void {
  /**
   * Only the document in FRONT, which is the whole subtlety: a 3D generation lands in the tab it
   * was launched from, and that tab is often not the one being looked at. Unfiltered, a model
   * arriving in the background would take the inspector off the layer someone was editing.
   */
  const stopScenes = useScenes.subscribe((state, previous) => {
    const documentId = activeSceneId(useDocuments.getState())
    if (!documentId) return

    const picked = state.states[documentId]?.selectedIds
    if (!picked || picked === previous.states[documentId]?.selectedIds) return

    useSelection.getState().pointAtNodes(documentId, picked.length > 0)
  })

  /**
   * The other half, and without it the filter above only moves the defect: a generation lands in
   * a background tab, selects its node there, and nothing points the inspector when that tab is
   * finally brought forward — the outliner highlights the model while the panel still describes
   * the asset it came from.
   *
   * Only when the scene HAS something picked: a tab brought forward with nothing selected has
   * nothing to say, and clearing there would take the panel off whatever was picked elsewhere.
   */
  const stopDocuments = useDocuments.subscribe((state, previous) => {
    if (state.activeId === previous.activeId) return

    const documentId = activeSceneId(state)
    if (!documentId) return

    const picked = sceneOf(useScenes.getState(), documentId).selectedIds
    if (picked.length > 0) useSelection.getState().pointAtNodes(documentId, true)
  })

  return () => {
    stopScenes()
    stopDocuments()
  }
}
