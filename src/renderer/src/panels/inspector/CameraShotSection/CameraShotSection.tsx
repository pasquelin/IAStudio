import { mdiVectorPolyline } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { POINT_TARGET, type CameraShot, type CameraTarget } from '@shared/domain/animation'
import { PropertyRow } from '@/design/PropertyRow'
import { PropertySection } from '@/design/PropertySection'
import { SelectField } from '@/design/SelectField'
import { ToolButton } from '@/design/ToolButton'
import { VectorField } from '@/design/VectorField'
import type { GestureProps } from '@/design/styles'
import {
  bindRailToShot,
  editCameraShot,
  railForShot,
  railOnNewShot,
} from '@/engines/scene/animationCommands'
import type { Command } from '@/engines/core/history'
import type { CameraNode, SceneNode, SceneState } from '@/engines/scene/sceneState'
import { TIP_LEFT } from '@/helpers/tooltip'
import { CameraShotSectionMotion } from './CameraShotSectionMotion'

export type CameraShotSectionProps = {
  camera: CameraNode
  /** The shot of this camera covering the head, or `null` when it has none there. */
  shot: CameraShot | null
  /** A shot for this camera from the head onwards, minted on demand — see `railOnNewShot`. */
  shotAtHead: () => CameraShot
  nodes: readonly SceneNode[]
  run: (command: Command<SceneState>) => void
  gesture: GestureProps
}

/**
 * What a shot does with its camera: run it along a rail, and aim it at something.
 *
 * Both live on the SHOT rather than on the camera, which is what lets one camera travel in one
 * shot and stand still in the next — see `CameraShot`.
 */
export function CameraShotSection({
  camera,
  shot,
  shotAtHead,
  nodes,
  run,
  gesture,
}: CameraShotSectionProps) {
  const { t } = useTranslation()

  /**
   * Both lists sweep the WHOLE scene, whose identity is new on every value a gizmo drag emits —
   * so composed inline they walked every node twice per frame, to answer a question that only
   * changes when a node is added, removed or renamed.
   */
  const rails = useMemo(
    () => [
      { value: '', label: t('inspector.noRail') },
      ...nodes
        .filter(node => node.type === 'path')
        .map(rail => ({ value: rail.id, label: rail.name })),
    ],
    [nodes, t],
  )
  const targets = useMemo(
    () => [
      { value: '', label: t('inspector.noTarget') },
      { value: POINT_TARGET.kind, label: t('inspector.targetPoint') },
      ...nodes
        .filter(node => node.id !== camera.id)
        .map(node => ({ value: node.id, label: node.name })),
    ],
    [nodes, camera.id, t],
  )

  if (!shot) {
    return (
      <PropertySection title={t('inspector.shot')}>
        <PropertyRow label={t('inspector.rail')}>
          {/* Offered with no shot to hang it on: a rail drives nothing on its own, so the one
              gesture opens both — and the button was unreachable until a shot was posed elsewhere.
              What it does is the button's TOOLTIP: a sentence laid in the row beside it overran
              the panel and pushed the label out of line with every other row. */}
          <ToolButton
            icon={mdiVectorPolyline}
            label={t('inspector.addRail')}
            description={t('inspector.addRailHint')}
            tooltip={TIP_LEFT}
            variant="header"
            onClick={() => run(railOnNewShot(camera, shotAtHead()))}
          />
        </PropertyRow>
      </PropertySection>
    )
  }

  const target = shot.target
  const aimAt = (choice: string): void => {
    if (choice === '') return run(editCameraShot(shot.id, { target: undefined }))

    const chosen: CameraTarget =
      choice === POINT_TARGET.kind ? POINT_TARGET : { kind: 'node', nodeId: choice }
    run(editCameraShot(shot.id, { target: chosen }))
  }

  return (
    <PropertySection title={t('inspector.shot')}>
      <SelectField
        label={t('inspector.rail')}
        value={shot.motion?.pathId ?? ''}
        options={rails}
        onChange={pathId => run(bindRailToShot(shot, pathId))}
        scId="shot.rail"
        actions={
          <ToolButton
            icon={mdiVectorPolyline}
            label={t('inspector.addRail')}
            description={t('inspector.addRailHint')}
            tooltip={TIP_LEFT}
            variant="header"
            onClick={() => run(railForShot(camera, shot))}
          />
        }
      />

      {shot.motion && (
        <CameraShotSectionMotion
          motion={shot.motion}
          onChange={motion => run(editCameraShot(shot.id, { motion }))}
          gesture={gesture}
        />
      )}

      <SelectField
        label={t('inspector.target')}
        value={target?.kind === 'node' ? target.nodeId : (target?.kind ?? '')}
        options={targets}
        onChange={aimAt}
        scId="shot.target"
      />

      {target?.kind === POINT_TARGET.kind && (
        <VectorField
          label={t('inspector.targetAt')}
          value={target.at}
          step={0.1}
          onChange={at => run(editCameraShot(shot.id, { target: { kind: POINT_TARGET.kind, at } }))}
          {...gesture}
        />
      )}
    </PropertySection>
  )
}
