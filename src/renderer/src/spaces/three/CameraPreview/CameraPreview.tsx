import { mdiArrowExpand, mdiArrowCollapse } from '@mdi/js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { activeShotAt } from '@/engines/scene/cameraShots'
import { selectedNodes } from '@/engines/scene/sceneState'
import { insetRect, type PaneRect } from '@/engines/viewport/panes'
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
 * The rectangle is decided HERE and handed to the engine, which draws into it: the frame, the
 * name and the buttons are DOM over the canvas, and two rectangles agreeing by construction is
 * the only way a border stays around its picture.
 *
 * It opens on a camera being selected and closes with that selection — selected is not on air,
 * and the badge is what says when the two happen to coincide.
 */
export function CameraPreview({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  const timeline = useScenes(state => sceneOf(state, documentId).animation)
  const view = useSceneViews(state => sceneViewOf(state, documentId))

  const anchor = selectedNodes(nodes, selectedIds).at(-1) ?? null
  const camera = anchor?.type === 'camera' ? anchor : null
  const full = view.previewSize === 'full'
  // Memoised on what it is made of: the engine is told about a rect by identity, and a fresh
  // object per render would hand it the same rectangle sixty times a second.
  const rect: PaneRect | null = useMemo(
    () =>
      !camera
        ? null
        : full
          ? { x: 0, y: 0, width: size.width, height: size.height }
          : insetRect(size.width, size.height, FILM_ASPECT),
    [camera, full, size],
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
    engine?.setCameraPreview(camera?.id ?? null, rect)

    // Closed on the way out, or a preview would keep being drawn over a document nobody is
    // looking at any more — the engine outlives this component.
    return () => engine?.setCameraPreview(null, null)
  }, [documentId, camera?.id, rect])

  const onAir =
    camera !== null && activeShotAt(timeline, nodes, view.playhead)?.cameraId === camera.id

  return (
    <div ref={host} className="pointer-events-none absolute inset-0">
      {camera && rect && (
        <div
          // The frame turns to the head's own ink while this camera is the one on air — the same
          // signal its bar wears in the dope sheet, and the only state an eye cannot deduce.
          className={cn(
            'absolute flex flex-col justify-between border',
            onAir ? 'border-accent' : 'border-border',
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
