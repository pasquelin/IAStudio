import { mdiArrowExpand, mdiArrowCollapse } from '@mdi/js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { activeCameraAt } from '@/engines/scene/cameraShots'
import { selectedNodes } from '@/engines/scene/sceneState'
import { previewRect, type PaneRect } from '@/engines/viewport/panes'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'

/** What a film is written at, so the preview frames what a render would actually hold. */
const FILM_ASPECT = 16 / 9

/**
 * What the selected camera films, drawn in the corner of the viewport.
 *
 * The rectangle is decided HERE and handed to the engine: the frame around the picture is DOM,
 * and two rectangles agreeing by construction is the only way it stays around it.
 */
export function CameraPreview({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  const timeline = useScenes(state => sceneOf(state, documentId).animation)
  // Two narrow selectors rather than the whole view: `setPlayhead` replaces that object on every
  // frame of playback, and this component would re-render sixty times a second for two fields.
  const previewSize = useSceneViews(state => sceneViewOf(state, documentId).previewSize)
  const playhead = useSceneViews(state => sceneViewOf(state, documentId).playhead)

  const anchor = selectedNodes(nodes, selectedIds).at(-1) ?? null
  const camera = anchor?.type === 'camera' ? anchor : null
  const cameraId = camera?.id ?? null
  // Memoised on the camera's ID rather than the node: moving it hands over a fresh object, and
  // the engine would be told about a rectangle that has not changed a pixel.
  const rect: PaneRect | null = useMemo(
    () => (cameraId ? previewRect(size.width, size.height, FILM_ASPECT, previewSize) : null),
    [cameraId, previewSize, size],
  )

  useEffect(() => {
    const node = host.current
    if (!node) return

    const observer = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect
      if (!box) return

      // Same numbers, same object: a resize that changes neither must not redraw the frame, nor
      // hand the engine a rectangle it is already drawing into.
      setSize(current =>
        current.width === box.width && current.height === box.height
          ? current
          : { width: box.width, height: box.height },
      )
    })
    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const engine = sceneEngineOf(documentId)
    engine?.setCameraPreview(cameraId, rect)

    // The engine outlives this component: left open, it would draw over a document nobody sees.
    return () => engine?.setCameraPreview(null, null)
  }, [documentId, cameraId, rect])

  // `activeCameraAt` and nothing else, so the badge cannot disagree with what the montage and
  // the film are drawing — its fall back to the first camera included.
  const onAir = camera !== null && activeCameraAt(timeline, nodes, playhead) === camera.id
  const full = previewSize === 'full'

  return (
    <div ref={host} className="pointer-events-none absolute inset-0">
      {camera && rect && (
        <div
          // `muted` and not `border`, which is the frame of a panel: this one sits ON the
          // viewport, and #34363a over #33363b is one step of one channel — invisible.
          // On air, the frame takes the head's own ink — the signal its bar wears in the sheet.
          className={cn(
            'absolute flex flex-col justify-between border',
            onAir ? 'border-accent' : 'border-muted',
          )}
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        >
          <div className="flex items-start justify-between gap-2 p-1">
            <span className="text-text text-tiny min-w-0 truncate">{camera.name}</span>
            {onAir && (
              <span className="bg-elevated text-text text-tiny shrink-0 px-1">
                {t('scene.onAir')}
              </span>
            )}
          </div>
          <div className="pointer-events-auto flex justify-end p-1">
            <ToolButton
              icon={full ? mdiArrowCollapse : mdiArrowExpand}
              label={full ? t('scene.previewInset') : t('scene.previewFull')}
              tooltip={TIP_LEFT}
              variant="header"
              onClick={() =>
                useSceneViews.getState().setPreviewSize(documentId, full ? 'inset' : 'full')
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
