import { mdiRunFast } from '@mdi/js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BundledAnimation } from '@shared/domain/animationLibrary'
import { clipKeyOf, DEFAULT_CLIP, type ClipRef, type ClipSource } from '@shared/domain/scene'
import { EmptyState } from '@/design/EmptyState'
import { addModelClip, removeModelClip } from '@/engines/scene/commands'
import { nodeById, type SceneState } from '@/engines/scene/sceneState'
import type { PreviewWatch } from '@/engines/scene/sceneView'
import { clipLabel } from '@/helpers/clipLabel'
import { newId } from '@/helpers/ids'
import { clipsOfNode, useModelClips } from '@/stores/modelClips'
import { useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { AnimationsPanelRow } from './AnimationsPanelRow'

/**
 * What a character can be made to play: the clips its file brought, and those the app ships with.
 * `▶` lays the REAL block and watches it, so a preview the playhead interrupts leaves its block
 * standing — which is exactly what dragging the row would have laid.
 */
export function AnimationsPanel() {
  const { t } = useTranslation()
  const documentId = useDocuments(state => state.activeId)
  const [bundled, setBundled] = useState<readonly BundledAnimation[]>([])
  /** The block laid to be watched, with the very preview this panel opened on it — see `held`. */
  const [watched, setWatched] = useState<{ clip: ClipRef; look: PreviewWatch } | null>(null)
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

  // Ours while OUR preview is the one running, compared by IDENTITY and never by clip id: the
  // playhead drops it without touching the block, and a surface that later watches that same
  // block must not hand it back — what an interruption leaves standing is kept work.
  const held = watched && preview === watched.look ? watched : null

  // By SOURCE and never by label: a label reaches the screen translated, and an identity that
  // changes with the language would lose the row at the first switch.
  const playingIs = (source: ClipSource): boolean =>
    held !== null &&
    held.look.nodeId === nodeId &&
    clipKeyOf(held.clip.source) === clipKeyOf(source)

  const watch = (source: ClipSource, label: string): void => {
    if (!documentId || !nodeId) return

    // Off the character it went ON, which is not always the one in front: the block IS the
    // preview, and two of them left behind would play at once. Guarded on the block STILL being
    // there — a ⌘Z took it out under us, and a command that removes nothing wipes the redo.
    if (held && stillLaid(sceneOf(useScenes.getState(), documentId), held)) {
      useScenes.getState().runCommand(documentId, removeModelClip(held.look.nodeId, held.clip.id))
    }
    useSceneViews.getState().setPreview(documentId, null)
    // Pressing the row that plays only STOPS it: its block has just been taken off.
    if (playingIs(source)) {
      setWatched(null)
      return
    }

    const laid = { ...DEFAULT_CLIP, id: newId(), source, label }
    const look = { nodeId, clipId: laid.id, at: 0, playing: true }
    useScenes.getState().runCommand(documentId, addModelClip(nodeId, laid))
    useSceneViews.getState().setPreview(documentId, look)
    setWatched({ clip: laid, look })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1">
      {own.map(clip => (
        <AnimationsPanelRow
          key={`own:${clip}`}
          name={clipLabel(clip, t)}
          source={{ kind: 'embedded', clip }}
          playing={playingIs({ kind: 'embedded', name: clip })}
          // The label goes into the document, so it stays the file's own word — the band
          // translates it on the way out. A French string written into a glTF is not a label.
          onPlay={nodeId ? () => watch({ kind: 'embedded', name: clip }, clip) : undefined}
        />
      ))}
      {bundled.map(animation => (
        <AnimationsPanelRow
          key={`bundled:${animation.name}`}
          name={animation.name}
          thumbnail={animation.thumbnail}
          source={{ kind: 'bundled', name: animation.name }}
          playing={playingIs({ kind: 'bundled', name: animation.name })}
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

/** Whether the watched block is still on its character: a ⌘Z takes it out without a word. */
function stillLaid(scene: SceneState, held: { clip: ClipRef; look: PreviewWatch }): boolean {
  const node = nodeById(scene, held.look.nodeId)
  if (node?.type !== 'model') return false
  return (node.model.lanes ?? []).some(lane => lane.clips.some(clip => clip.id === held.clip.id))
}
