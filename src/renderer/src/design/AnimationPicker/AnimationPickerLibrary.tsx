import { mdiFileOutline, mdiPackageVariantClosed } from '@mdi/js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BundledAnimation } from '@shared/domain/animationLibrary'
import type { ClipSource } from '@shared/domain/scene'
import { Row } from '../Row'
import { rowSkin } from '../styles'
import { clipLabel } from '@/helpers/clipLabel'
import { useProjectAnimations } from '@/hooks/useProjectAnimations'
import { clipsOfNode, useModelClips } from '@/stores/modelClips'
import { assetIcon } from '@/helpers/workspaces'

export type AnimationPickerLibraryProps = {
  documentId: string
  nodeId: string
  onChoose: (source: ClipSource, label: string) => void
}

/**
 * Everything already at hand: the character's own clips, the animations the app ships with, and
 * whatever the project files as motion.
 *
 * One list rather than three, because from where someone stands all three answer the same
 * question — and only the choice decides what a block ends up reading.
 */
export function AnimationPickerLibrary({
  documentId,
  nodeId,
  onChoose,
}: AnimationPickerLibraryProps) {
  const { t } = useTranslation()
  const [bundled, setBundled] = useState<readonly BundledAnimation[]>([])
  const own = useModelClips(state => clipsOfNode(state, documentId, nodeId))
  const motions = useProjectAnimations()

  useEffect(() => {
    let alive = true
    void window.studio.animations.list().then(found => {
      if (alive) setBundled(found)
    })
    return () => void (alive = false)
  }, [])

  if (own.length === 0 && bundled.length === 0 && motions.length === 0) {
    return <p className="text-muted text-tiny p-2">{t('inspector.animationLibraryEmpty')}</p>
  }

  /**
   * One line per motion, whichever of the three it comes from — the row is the shared one.
   *
   * `label` is what goes into the document and `shown` is what the row reads: they part company
   * for a clip the exporter named, where a translated word must not be written into a glTF.
   */
  const offer = (key: string, label: string, source: ClipSource, icon: string, shown = label) => (
    <li key={key}>
      <button type="button" className={rowSkin(false)} onClick={() => onChoose(source, label)}>
        <Row icon={icon} title={shown} />
      </button>
    </li>
  )

  return (
    <ul>
      {own.map(clip =>
        offer(
          `own:${clip}`,
          clip,
          { kind: 'embedded', name: clip },
          mdiFileOutline,
          clipLabel(clip, t),
        ),
      )}
      {bundled.map(animation =>
        offer(
          `bundled:${animation.name}`,
          animation.name,
          { kind: 'bundled', name: animation.name },
          mdiPackageVariantClosed,
        ),
      )}
      {motions.map(asset =>
        offer(
          `asset:${asset.id}`,
          asset.name,
          { kind: 'asset', assetId: asset.id, name: asset.name },
          assetIcon('animation'),
        ),
      )}
    </ul>
  )
}
