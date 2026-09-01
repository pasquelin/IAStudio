import { mdiFileOutline, mdiPackageVariantClosed } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { ClipSource } from '@shared/domain/scene'
import { QuietNote } from '@/components/QuietNote'
import { Row } from '@/components/Row'
import { rowSkin } from '@/components/styles'
import { clipLabel } from '@/helpers/clipLabel'
import { useBundledAnimations } from '@/hooks/useBundledAnimations'
import { useProjectAnimations } from '@/hooks/useProjectAnimations'
import { clipsOfNode, useModelFiles } from '@/stores/modelFiles'
import { assetIcon } from '@/helpers/workspaces'

export type CharacterMotionPickerLibraryProps = {
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
export function CharacterMotionPickerLibrary({
  documentId,
  nodeId,
  onChoose,
}: CharacterMotionPickerLibraryProps) {
  const { t } = useTranslation()
  const bundled = useBundledAnimations()
  const own = useModelFiles(state => clipsOfNode(state, documentId, nodeId))
  const motions = useProjectAnimations()

  if (own.length === 0 && bundled.length === 0 && motions.length === 0) {
    return (
      <div className="p-2">
        <QuietNote>{t('inspector.animationLibraryEmpty')}</QuietNote>
      </div>
    )
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
