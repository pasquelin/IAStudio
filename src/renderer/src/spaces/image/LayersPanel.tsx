import { mdiEye, mdiEyeOffOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'
import { TIP_BOTTOM } from '@/design/tooltip'
import { ToolButton } from '@/design/ToolButton'
import { addLayer, removeLayer, selectLayer, setLayerVisible } from '@/engines/canvas/commands'
import { canvasOf, useCanvases } from '@/stores/canvases'

export type LayersPanelProps = { documentId: string }

/**
 * The layer stack, top of the list first — what the eye sees on top is what the hand reaches
 * first, and every editor lays it out that way. The state stores it the other way round,
 * bottom first, because that is the order it is drawn in.
 */
export function LayersPanel({ documentId }: LayersPanelProps) {
  const { t } = useTranslation()
  const canvas = useCanvases(state => canvasOf(state, documentId))
  const store = useCanvases.getState()

  const create = () => {
    const index = canvas.layers.length + 1
    store.runCommand(
      documentId,
      addLayer({
        id: crypto.randomUUID(),
        name: t('layers.untitled', { n: index }),
        visible: true,
        locked: false,
        opacity: 1,
        blend: 'normal',
      }),
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex items-center gap-1 border-b px-2 py-1.5">
        <span className="text-muted text-[11px]">{t('layers.title')}</span>
        <span className="ml-auto flex items-center gap-0.5">
          <ToolButton
            icon={mdiPlus}
            label={t('layers.add')}
            tooltip={TIP_BOTTOM}
            variant="header"
            onClick={create}
          />
          <ToolButton
            icon={mdiTrashCanOutline}
            label={t('layers.remove')}
            tooltip={TIP_BOTTOM}
            variant="header"
            // The last layer never goes: a canvas with an empty stack cannot be painted on.
            disabled={canvas.layers.length <= 1 || canvas.activeLayerId === null}
            onClick={() =>
              canvas.activeLayerId &&
              store.runCommand(documentId, removeLayer(canvas.activeLayerId))
            }
          />
        </span>
      </div>

      <ul className="min-h-0 flex-1 overflow-auto p-1">
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
                tooltip={TIP_BOTTOM}
                variant="header"
                // The row selects on pointer down, which fires before click: stopping the
                // click alone would still have let the eye steal the selection.
                onPointerDown={event => event.stopPropagation()}
                onClick={() =>
                  store.runCommand(documentId, setLayerVisible(layer.id, !layer.visible))
                }
              />
              <span
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
    </div>
  )
}
