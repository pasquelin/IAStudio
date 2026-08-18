import { mdiRunFast } from '@mdi/js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BundledAnimation } from '@shared/domain/animationLibrary'
import { EmptyState } from '@/design/EmptyState'
import { clipsOfNode, useModelClips } from '@/stores/modelClips'
import { useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import { AnimationsPanelRow } from './AnimationsPanelRow'

/**
 * What a character can be made to play: the clips its own file brought, and the animations the
 * app ships with. A row is DRAGGED onto a sub-track of the band, which is what puts a block on it.
 *
 * The two sources are shown as one list on purpose — from where someone stands, both answer the
 * same question, and only the drop decides what a block ends up playing.
 */
export function AnimationsPanel() {
  const { t } = useTranslation()
  const documentId = useDocuments(state => state.activeId)
  const [bundled, setBundled] = useState<readonly BundledAnimation[]>([])

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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1">
      {own.map(clip => (
        <AnimationsPanelRow key={`own:${clip}`} name={clip} source={{ kind: 'embedded', clip }} />
      ))}
      {bundled.map(animation => (
        <AnimationsPanelRow
          key={`bundled:${animation.path}`}
          name={animation.name}
          thumbnail={animation.thumbnail}
          source={{ kind: 'bundled', path: animation.path }}
        />
      ))}
    </div>
  )
}
