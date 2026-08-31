import { useEffect } from 'react'
import type { Us } from '@shared/domain/time'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { useAnimationPlayback } from '@/hooks/useAnimationPlayback'
import { sceneViewOf, useScenePlayhead, useScenePreview, useSceneViews } from '@/stores/sceneViews'

/** The only playhead subscriber, so the viewport host does not re-render per frame. */
export function SceneClock({
  documentId,
  duration,
  renderer,
}: {
  documentId: string
  duration: Us
  renderer: SceneRenderer | null
}) {
  const playhead = useScenePlayhead(documentId)
  const preview = useScenePreview(documentId)
  const playing = useSceneViews(state => sceneViewOf(state, documentId).playing)

  useEffect(() => {
    renderer?.setPlayhead(playhead)
  }, [renderer, playhead])

  useEffect(() => {
    renderer?.setPreview(preview)
  }, [renderer, preview])

  useAnimationPlayback(documentId, playing, duration)
  return null
}
