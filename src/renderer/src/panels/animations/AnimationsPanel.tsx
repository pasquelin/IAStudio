import { mdiRunFast } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { clipKeyOf, DEFAULT_CLIP, type ClipRef, type ClipSource } from '@shared/domain/scene'
import { EmptyState } from '@/components/EmptyState'
import { laneHolding } from '@/engines/scene/clipBlend'
import { addModelClip, removeModelClip } from '@/engines/scene/commands'
import { nodeById, type SceneState } from '@/engines/scene/sceneState'
import { clipLabel } from '@/helpers/clipLabel'
import { useBundledAnimations } from '@/hooks/useBundledAnimations'
import { newId } from '@/helpers/ids'
import { clipsOfNode, useModelFiles } from '@/stores/modelFiles'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useScenePreview, useSceneViews, type WatchedPreview } from '@/stores/sceneViews'
import { AnimationsPanelRow } from './AnimationsPanelRow'

/** What a character can be made to play: the clips its file brought, and those the app ships with. */
export function AnimationsPanel() {
  const { t } = useTranslation()
  const documentId = useDocuments(activeSceneId)
  const bundled = useBundledAnimations()
  const preview = useScenePreview(documentId ?? '')

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
  const own = useModelFiles(state => clipsOfNode(state, documentId ?? '', nodeId ?? ''))

  if (own.length === 0 && bundled.length === 0) {
    return <EmptyState icon={mdiRunFast} message={t('animations.empty')} />
  }

  // Ours while the running preview says WE laid it: the playhead drops that preview without
  // touching the block, and a surface that later watches the same block writes a preview of its
  // own without `laid` — what an interruption leaves standing is kept work.
  const held = laidHere(preview) ? preview : null

  // By SOURCE and never by label: a label reaches the screen translated, and an identity that
  // changes with the language would lose the row at the first switch.
  const playingIs = (source: ClipSource): boolean =>
    held !== null && held.nodeId === nodeId && clipKeyOf(held.laid.source) === clipKeyOf(source)

  const watch = (source: ClipSource, label: string): void => {
    if (!documentId || !nodeId) return

    // Off the character it went ON, which is not always the one in front: the block IS the
    // preview, and two of them left behind would play at once. Guarded on the block still being
    // the one we laid — a ⌘Z takes it out, the band turns it into work, and either way a command
    // that removes nothing wipes the redo.
    if (held && stillOurs(sceneOf(useScenes.getState(), documentId), held)) {
      useScenes.getState().runCommand(documentId, removeModelClip(held.nodeId, held.clipId))
    }
    // Pressing the row that plays only STOPS it: its block has just been taken off.
    if (playingIs(source)) {
      useSceneViews.getState().setPreview(documentId, null)
      return
    }

    const laid = { ...DEFAULT_CLIP, id: newId(), source, label }
    useScenes.getState().runCommand(documentId, addModelClip(nodeId, laid))
    useSceneViews
      .getState()
      .setPreview(documentId, { nodeId, clipId: laid.id, at: 0, playing: true, laid })
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

/** Whether this panel is the one watching, which is what makes the block its own to take back. */
function laidHere(watch: WatchedPreview | null): watch is WatchedPreview & { laid: ClipRef } {
  return watch?.laid !== undefined
}

/**
 * Whether the block on the character is still the very one we laid, by IDENTITY: a ⌘Z takes it
 * out, and every band edit hands back a new ref for the block it rewrites — moved or trimmed, a
 * try has become work, and taking it back would destroy that work without a word.
 */
function stillOurs(scene: SceneState, held: WatchedPreview & { laid: ClipRef }): boolean {
  const node = nodeById(scene, held.nodeId)
  if (node?.type !== 'model') return false
  return laneHolding(node.model.lanes ?? [], held.clipId)?.clips.includes(held.laid) === true
}
