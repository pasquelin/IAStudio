import { mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { addLayer, removeLayer } from '@/engines/canvas/commands'
import { newId } from '@/helpers/ids'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { canvasOf, useCanvases } from '@/stores/canvases'

/** Add and delete for one stack, on the panel's own title bar. */
export function LayerStackActions({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const canvas = useCanvases(state => canvasOf(state, documentId))
  const store = useCanvases.getState()

  const create = (): void => {
    store.runCommand(
      documentId,
      addLayer({
        id: newId(),
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
