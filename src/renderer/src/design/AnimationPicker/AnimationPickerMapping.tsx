import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clipKeyOf, type ClipSource } from '@shared/domain/scene'
import { QuietNote } from '../QuietNote'
import { Row } from '../Row'
import { INLINE_LINK } from '../styles'
import { clipFitOfNode, useModelClips } from '@/stores/modelClips'

export type AnimationPickerMappingProps = {
  documentId: string
  nodeId: string
  source: ClipSource
}

/**
 * Whether the motion fits, and — only when asked — which joints it does not reach.
 *
 * Never a list of bones up front: the issue is explicit about that, and the plain answer is one
 * line. What opens is a list of ROLES and not of bone names, because that is the only vocabulary
 * two skeletons share — `mixamorigLeftHand` and `L_Hand` are the same joint and no string says so.
 *
 * Putting one right is the bone editor's business, on the character's own rig, which is where a
 * click in the viewport already names a bone.
 */
export function AnimationPickerMapping({
  documentId,
  nodeId,
  source,
}: AnimationPickerMappingProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const fit = useModelClips(state => clipFitOfNode(state, documentId, nodeId, clipKeyOf(source)))

  // Nothing was retargeted, so there is no fit to speak of — a clip the character's own file
  // brought speaks its skeleton already.
  if (!fit) return null

  const missing = [...fit.missingInSource, ...fit.missingInTarget]
  if (missing.length === 0) return <QuietNote>{t('inspector.animationFits')}</QuietNote>

  return (
    <div className="flex flex-col gap-2">
      <QuietNote>{t('inspector.animationFitsPartly')}</QuietNote>
      <button type="button" className={INLINE_LINK} onClick={() => setOpen(!open)}>
        {t(open ? 'inspector.animationHideJoints' : 'inspector.animationShowJoints')}
      </button>
      {open && (
        <ul>
          {fit.missingInSource.map(role => (
            <li key={`source:${role}`}>
              <Row title={role} subtitle={t('inspector.animationJointAtRest')} />
            </li>
          ))}
          {fit.missingInTarget.map(role => (
            <li key={`target:${role}`}>
              <Row title={role} subtitle={t('inspector.animationJointDropped')} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
