import { DockviewReact, type DockviewReadyEvent } from 'dockview-react'
import { useCallback } from 'react'
import { ASSET_TYPES, type Asset } from '@shared/domain/asset'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { reportFailure } from '@/services/diagnostics'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { DocumentTab } from './DocumentTab'
import { DOCUMENT_COMPONENTS } from './documents'
import { setDockviewApi } from './dockview-api'

/**
 * Imported at the drop rather than at the top, and the guard in `eager-graph.test.ts` is what
 * says why: `openAsset` reaches `ASSET_INTENTS`, which names every editor's destination — so a
 * static import pulled four files out of `spaces/` into the chunk the first screen loads, for a
 * gesture that may never happen. A drop is a human action; the module arrives well before the
 * hand has let go.
 */
const openDropped = (asset: Asset): void => {
  void import('@/helpers/open-asset').then(module => module.openAsset(asset))
}

/**
 * Dockview, remounted per workspace by its `key`: coming back to "3D" must restore that
 * workspace's tabs, not the ones from "Image".
 *
 * Remounting destroys the WebGL context of any open viewport. That is the point — engines are
 * rebuilt from their state, never moved, which is what detaching a panel into another window
 * will demand.
 */
export function DocumentArea() {
  const workspace = useLayouts(state => state.activeWorkspace)
  // Keyed by the project too: Dockview holds its panels itself, and dropping the stored layout
  // of the project being left would otherwise leave its tabs on screen — then persist them
  // again, under the project that never had them, on the first layout change.
  const projectPath = useLayouts(state => state.projectPath)

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const stored = useLayouts.getState().layouts[workspace]
      if (stored) {
        try {
          event.api.fromJSON(stored)
        } catch (error) {
          // Dockview rethrows a layout it refuses from inside its own mount effect, where an
          // uncaught throw would take the window down on every launch. Forgotten, not kept:
          // nothing reloads it afterwards, so a kept one would fail again at every switch.
          reportFailure('shell.layout', workspace, error)
          useLayouts.getState().forget(workspace)
        }
      }

      // AFTER the stored layout is restored, never before: handing the api over drains the
      // documents waiting for this workspace, and `fromJSON` clears the panels it did not name —
      // a document opened from another workspace would be added and then thrown away.
      setDockviewApi(workspace, event.api)

      event.api.onDidLayoutChange(() => {
        useLayouts.getState().remember(workspace, event.api.toJSON())
      })

      // Tool windows live outside Dockview: without this, a layer stack on the edge has no way
      // of knowing which tab it is looking at.
      useDocuments.getState().activate(event.api.activePanel?.id ?? null)
      event.api.onDidActivePanelChange(change => {
        useDocuments.getState().activate(change.panel?.id ?? null)
      })
    },
    [workspace],
  )

  /**
   * The one place a dropped asset is OPENED, and the last surface to see the drop.
   *
   * Every other target in the studio answers a different question — which channel of a material,
   * which track and at what time, where on the graph — and each needs the pointer in its own
   * frame. That is why the platform attaches a drop to an element rather than to the document,
   * and it is what cannot be centralised.
   *
   * What can, and is here, is the FALLBACK: a target that handles a drop consumes it, so
   * anything still reaching this one is a drop nobody wanted — the empty middle, the ruler of a
   * timeline, a document that refuses the kind. It opens the asset in its own space, which is
   * what an editor does with a file dropped on it.
   *
   * Mounted whether or not a tab is open, and that is the point: "only when nothing is open"
   * was a second rule for the same gesture, and it answered a drop beside an open document with
   * nothing at all.
   */
  return (
    <AssetDropTarget
      accepts={ASSET_TYPES}
      onDrop={openDropped}
      // No frame: this surface is the whole middle of the window, so outlining it says nothing
      // the user cannot already see. The pointer carries the answer instead — see `outlined`.
      outlined={false}
      className="size-full"
    >
      <DockviewReact
        key={`${projectPath ?? ''}:${workspace}`}
        components={DOCUMENT_COMPONENTS}
        // Every tab, not a per-panel choice: closing a document has to ask about unsaved work
        // whichever space opened it.
        defaultTabComponent={DocumentTab}
        onReady={onReady}
      />
    </AssetDropTarget>
  )
}
