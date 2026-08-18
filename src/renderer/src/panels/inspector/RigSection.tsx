import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { ProgressBar } from '@/design/ProgressBar'
import { PropertySection } from '@/design/PropertySection'
import { QuietNote } from '@/design/QuietNote'
import { rigFit, rigFitFaultOf } from '@/engines/scene/rigFit'
import { setModelRig } from '@/engines/scene/commands'
import type { ModelNode } from '@/engines/scene/sceneState'
import type { SceneEdit } from '@/hooks/useSceneEdit'
import { rigOfNode, rigProgressOfNode, useModelClips } from '@/stores/modelClips'

export type RigSectionProps = {
  documentId: string
  node: ModelNode
  edit: SceneEdit
}

/**
 * Making a bare mesh animatable, without saying « rig » once.
 *
 * The whole operation is local and free, so there is no cost dialogue and nothing to confirm: the
 * click writes a skeleton into the document, and the engine works out the weights from it.
 */
export function RigSection({ documentId, node, edit }: RigSectionProps) {
  const { t } = useTranslation()
  const rig = useModelClips(state => rigOfNode(state, documentId, node.id))
  const progress = useModelClips(state => rigProgressOfNode(state, documentId, node.id))

  // Only where the studio has something to offer: a model that already carries a skeleton of its
  // own is never offered another, and one still loading has nothing to measure.
  if (!rig || (rig.status !== 'staticMesh' && !node.model.rig)) return null

  // Held so the `onClick` closure narrows: a property access does not stay narrowed inside one.
  const bounds = rig.bounds
  const fault = bounds && rigFitFaultOf(bounds)

  return (
    <PropertySection title={t('inspector.rig')}>
      {progress !== null && <ProgressBar ratio={progress} label={t('inspector.rigBinding')} />}

      {progress === null && fault && <QuietNote>{t(`inspector.rigFault_${fault}`)}</QuietNote>}

      {progress === null && bounds && !fault && !node.model.rig && (
        <Button variant="primary" onClick={() => edit.run(setModelRig(node.id, rigFit(bounds)))}>
          {t('inspector.makeAnimatable')}
        </Button>
      )}

      {progress === null && node.model.rig && (
        <>
          <QuietNote>{t('inspector.rigReady')}</QuietNote>
          <Button onClick={() => edit.run(setModelRig(node.id, null))}>
            {t('inspector.removeRig')}
          </Button>
        </>
      )}
    </PropertySection>
  )
}
