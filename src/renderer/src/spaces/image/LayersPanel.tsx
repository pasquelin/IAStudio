import { mdiEye, mdiEyeOffOutline, mdiLayersOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'
import { TIP_BOTTOM, TIP_RIGHT } from '@/design/tooltip'
import { ToolButton } from '@/design/ToolButton'
import { addLayer, removeLayer, selectLayer, setLayerVisible } from '@/engines/canvas/commands'
import { EmptyState } from '@/panels/EmptyState'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { useDocuments } from '@/stores/documents'

/**
 * The layer stack of whatever document is in front. A tool window has no props — it sits on the
 * edge, outside Dockview — so it follows the active tab rather than being handed one.
 *
 * It renders no header and no scroller of its own: `ToolWindow` wraps every tool in both, and a
 * second copy of either shows up as a doubled title bar and nested scrollbars.
 */
export function LayersPanel() {
  const { t } = useTranslation()
  const documentId = useDocuments(state => state.activeId)

  if (!documentId) return <EmptyState icon={mdiLayersOutline} message={t('layers.noDocument')} />
  return <LayerStack documentId={documentId} />
}

/** Add and delete, rendered by `ToolWindow` on the panel's own title bar. */
export function LayersActions() {
  const documentId = useDocuments(state => state.activeId)

  if (!documentId) return null
  return <StackActions documentId={documentId} />
}

function StackActions({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const canvas = useCanvases(state => canvasOf(state, documentId))
  const store = useCanvases.getState()

  const create = (): void => {
    store.runCommand(
      documentId,
      addLayer({
        id: crypto.randomUUID(),
        name: t('layers.untitled', { n: canvas.layers.length + 1 }),
        visible: true,
        locked: false,
        opacity: 1,
        blend: 'normal',
      }),
    )
  }

  return (
    <>
      <ToolButton
        icon={mdiPlus}
        label={t('layers.add')}
        description={t('layers.addHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        onClick={create}
      />
      <ToolButton
        icon={mdiTrashCanOutline}
        label={t('layers.remove')}
        description={t('layers.removeHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        // The last layer never goes: a canvas with an empty stack cannot be painted on.
        disabled={canvas.layers.length <= 1 || canvas.activeLayerId === null}
        onClick={() =>
          canvas.activeLayerId && store.runCommand(documentId, removeLayer(canvas.activeLayerId))
        }
      />
    </>
  )
}

/**
 * Top of the list first — what the eye sees on top is what the hand reaches first, and every
 * editor lays it out that way. The state stores it the other way round, bottom first, because
 * that is the order it is drawn in.
 *
 * Split from `LayersPanel` so the hooks below never run for a document that is not there: a
 * conditional return above a `useCanvases` call is what React forbids.
 */
function LayerStack({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const canvas = useCanvases(state => canvasOf(state, documentId))
  const store = useCanvases.getState()

  return (
    <ul className="p-1">
      {[...canvas.layers].reverse().map(layer => (
        <li key={layer.id}>
          <div
            className={cn(
              'group flex items-center gap-1 rounded-(--radius-sc-md) px-1',
              'h-(--sc-control) cursor-pointer',
              layer.id === canvas.activeLayerId ? 'bg-accent-soft' : 'hover:bg-elevated',
            )}
            onPointerDown={() => store.setCanvas(documentId, selectLayer(canvas, layer.id))}
          >
            <ToolButton
              icon={layer.visible ? mdiEye : mdiEyeOffOutline}
              label={t('layers.visible')}
              description={t(layer.visible ? 'layers.hideHint' : 'layers.showHint')}
              tooltip={TIP_RIGHT}
              variant="header"
              // The row selects on pointer down, which fires before click: stopping the
              // click alone would still have let the eye steal the selection.
              onPointerDown={event => event.stopPropagation()}
              onClick={() =>
                store.runCommand(documentId, setLayerVisible(layer.id, !layer.visible))
              }
            />
            {/* Tipped with its own name: the row truncates, and a truncated name is exactly
                the case where hovering is the only way to read it. */}
            <span
              {...TIP_RIGHT(layer.name)}
              className={cn(
                'truncate text-[11px]',
                layer.visible ? 'text-text' : 'text-muted line-through',
              )}
            >
              {layer.name}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
