import { mdiMovieOpenOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { firstCameraId } from '@/engines/scene/sceneState'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { documentExportName, useDocuments } from '@/stores/documents'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { sceneOf, useScenes } from '@/stores/scenes'

/** What a film is written at. One size for now, and a setting the day somebody asks for one. */
const FILM_WIDTH = 1920
const FILM_HEIGHT = 1080

/**
 * Writes the film. The camera is the first one the scene holds — a scene without one has nothing
 * to render FROM, so the button says that rather than being missing.
 */
export function AnimationActionsRenderButton({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  // The same rule a montage draws a live scene by — one place decides which camera a scene is
  // seen through, or the film and the clip would show two different shots of it.
  const camera = firstCameraId(nodes)

  const render = async (): Promise<void> => {
    const engine = sceneEngineOf(documentId)
    const bridge = getBridge()
    if (!engine || !bridge || !camera) return

    const { animation } = sceneOf(useScenes.getState(), documentId)
    const name = documentExportName(useDocuments.getState(), documentId, 'render')

    setBusy(true)
    const id = await bridge.render.start({ name, fps: animation.fps })
    if (!id) {
      setBusy(false)
      return
    }

    try {
      await engine.renderFilm(
        camera,
        {
          width: FILM_WIDTH,
          height: FILM_HEIGHT,
          fps: animation.fps,
          duration: animation.duration,
        },
        (index, png) => bridge.render.frame({ id, index, png }),
      )
      await bridge.render.finish(id)
    } catch (error) {
      await bridge.render.cancel(id)
      reportFailure('scene.render', name, error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolButton
      icon={mdiMovieOpenOutline}
      label={t('animation.render')}
      description={camera ? t('animation.renderHint') : t('animation.renderNeedsCamera')}
      tooltip={TIP_BOTTOM}
      variant="header"
      disabled={!camera || busy}
      onClick={() => void render()}
    />
  )
}
