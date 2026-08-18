import { mdiVectorPolyline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { POINT_TARGET, type CameraShot, type CameraTarget } from '@shared/domain/animation'
import { PropertyRow } from '@/design/PropertyRow'
import { PropertySection } from '@/design/PropertySection'
import { ToolButton } from '@/design/ToolButton'
import { VectorField } from '@/design/VectorField'
import { NATIVE_SELECT, type GestureProps } from '@/design/styles'
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

  if (!shot) {
    return (
      <PropertySection title={t('inspector.shot')}>
        <PropertyRow label={t('inspector.rail')}>
          <p className="text-muted text-tiny min-w-0 flex-1">{t('inspector.noShot')}</p>
          {/* Offered with no shot to hang it on: a rail drives nothing on its own, so the one
              gesture opens both — and the button was unreachable until a shot was posed elsewhere. */}
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
      <PropertyRow label={t('inspector.rail')}>
        <select
          value={shot.motion?.pathId ?? ''}
          onChange={event => run(bindRailToShot(shot, event.target.value))}
          className={NATIVE_SELECT}
        >
          <option value="">{t('inspector.noRail')}</option>
          {nodes
            .filter(node => node.type === 'path')
            .map(rail => (
              <option key={rail.id} value={rail.id}>
                {rail.name}
              </option>
            ))}
        </select>
        <ToolButton
          icon={mdiVectorPolyline}
          label={t('inspector.addRail')}
          description={t('inspector.addRailHint')}
          tooltip={TIP_LEFT}
          variant="header"
          onClick={() => run(railForShot(camera, shot))}
        />
      </PropertyRow>

      {shot.motion && (
        <CameraShotSectionMotion
          motion={shot.motion}
          onChange={motion => run(editCameraShot(shot.id, { motion }))}
          gesture={gesture}
        />
      )}

      <PropertyRow label={t('inspector.target')}>
        <select
          value={target?.kind === 'node' ? target.nodeId : (target?.kind ?? '')}
          onChange={event => aimAt(event.target.value)}
          className={NATIVE_SELECT}
        >
          <option value="">{t('inspector.noTarget')}</option>
          <option value={POINT_TARGET.kind}>{t('inspector.targetPoint')}</option>
          {nodes
            .filter(node => node.id !== camera.id)
            .map(node => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
        </select>
      </PropertyRow>

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
