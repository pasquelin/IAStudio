import { mdiRunFast } from '@mdi/js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BundledAnimation } from '@shared/domain/animationLibrary'
import { DEFAULT_CLIP, type ClipRef, type ClipSource } from '@shared/domain/scene'
import { EmptyState } from '@/design/EmptyState'
import { addModelClip, removeModelClip } from '@/engines/scene/commands'
import { newId } from '@/helpers/ids'
import { clipsOfNode, useModelClips } from '@/stores/modelClips'
import { useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { AnimationsPanelRow } from './AnimationsPanelRow'

/**
 * What a character can be made to play: the clips its own file brought, and the animations the
 * app ships with. A row is DRAGGED onto a sub-track of the band, which is what puts a block on it.
 *
 * The two sources are shown as one list on purpose — from where someone stands, both answer the
 * same question, and only the drop decides what a block ends up playing.
 *
 * `▶` plays one AT ONCE, by laying the real block and watching it — the same trade the picker
 * makes, and for the same reason: there is no rehearsal that could match the result. Pressing it
 * again takes the block back off. A preview the playhead interrupts leaves its block standing,
 * which is exactly what dragging the row would have laid.
 */
export function AnimationsPanel() {
  const { t } = useTranslation()
  const documentId = useDocuments(state => state.activeId)
  const [bundled, setBundled] = useState<readonly BundledAnimation[]>([])
  /** The block laid to be watched, so pressing another row takes this one away first. */
  const [watched, setWatched] = useState<ClipRef | null>(null)
  const preview = useSceneViews(state => sceneViewOf(state, documentId ?? '').preview)

  useEffect(() => {
    let alive = true
    void window.studio.animations.list().then(found => {
      if (alive) setBundled(found)
    })
    return () => void (alive = false)
  }, [])

  // The model in front, since a clip its file brought is only playable on IT.
  const nodeId = useScenes(state => {
    if (!documentId) return null
    const scene = sceneOf(state, documentId)
    const picked = scene.selectedIds[0]
    return scene.nodes.find(one => one.id === picked)?.type === 'model' ? (picked ?? null) : null
  })
  // Through `clipsOfNode` even when nothing is chosen, for the empty list it already holds: a
  // selector handing zustand a fresh literal on every render never settles, and React then stops
  // at the update limit.
  const own = useModelClips(state => clipsOfNode(state, documentId ?? '', nodeId ?? ''))

  if (own.length === 0 && bundled.length === 0) {
    return <EmptyState icon={mdiRunFast} message={t('animations.empty')} />
  }

  /** Whether the row for `label` is the one playing right now, and not merely the one laid. */
  const playingIs = (label: string): boolean =>
    watched?.label === label && preview?.clipId === watched.id

  const watch = (source: ClipSource, label: string): void => {
    if (!documentId || !nodeId) return

    // Whatever was laid goes first, whichever row is pressed: the block IS the preview, and two
    // of them left behind would play at once on the character.
    if (watched) useScenes.getState().runCommand(documentId, removeModelClip(nodeId, watched.id))
    useSceneViews.getState().setPreview(documentId, null)
    setWatched(null)
    if (playingIs(label)) return

    const laid = { ...DEFAULT_CLIP, id: newId(), source, label }
    useScenes.getState().runCommand(documentId, addModelClip(nodeId, laid))
    useSceneViews.getState().setPreview(documentId, { nodeId, clipId: laid.id })
    setWatched(laid)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1">
      {own.map(clip => (
        <AnimationsPanelRow
          key={`own:${clip}`}
          name={clip}
          source={{ kind: 'embedded', clip }}
          playing={playingIs(clip)}
          onPlay={nodeId ? () => watch({ kind: 'embedded', name: clip }, clip) : undefined}
        />
      ))}
      {bundled.map(animation => (
        <AnimationsPanelRow
          key={`bundled:${animation.name}`}
          name={animation.name}
          thumbnail={animation.thumbnail}
          source={{ kind: 'bundled', name: animation.name }}
          playing={playingIs(animation.name)}
          onPlay={
            nodeId
              ? () => watch({ kind: 'bundled', name: animation.name }, animation.name)
              : undefined
          }
        />
      ))}
    </div>
  )
}
