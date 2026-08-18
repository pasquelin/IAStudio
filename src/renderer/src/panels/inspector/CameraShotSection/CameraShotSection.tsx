import { mdiVectorPolyline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import {
  POINT_TARGET,
  type CameraMotion,
  type CameraShot,
  type CameraTarget,
} from '@shared/domain/animation'
import { PropertySection } from '@/design/PropertySection'
import { ToolButton } from '@/design/ToolButton'
import { VectorField } from '@/design/VectorField'
import { NATIVE_SELECT, type GestureProps } from '@/design/styles'
import { editCameraShot } from '@/engines/scene/animationCommands'
import { addNode, multi } from '@/engines/scene/commands'
import { pathNode } from '@/engines/scene/nodeFactory'
import type { Command } from '@/engines/core/history'
import type { CameraNode, SceneNode, SceneState } from '@/engines/scene/sceneState'
import { TIP_LEFT } from '@/helpers/tooltip'
import { CameraShotSectionMotion } from './CameraShotSectionMotion'

/** What a fresh binding takes: the whole rail, forwards, at a steady speed. */
const WHOLE_RAIL: Omit<CameraMotion, 'pathId'> = { from: 0, to: 1, easing: 'linear' }

export type CameraShotSectionProps = {
  camera: CameraNode
  /** The shot of this camera covering the head, or `null` when it has none there. */
  shot: CameraShot | null
  nodes: readonly SceneNode[]
  run: (command: Command<SceneState>) => void
  gesture: GestureProps
}

/**
 * What a shot does with its camera: run it along a rail, and aim it at something.
 *
 * Both live on the SHOT rather than on the camera, which is what lets one camera travel in one
 * shot and stand still in the next — see `CameraShot`. With no shot covering the head there is
 * nothing to bind, so the section says so rather than offering controls that write nowhere.
 */
export function CameraShotSection({ camera, shot, nodes, run, gesture }: CameraShotSectionProps) {
  const { t } = useTranslation()

  if (!shot) {
    return (
      <PropertySection title={t('inspector.shot')}>
        <p className="text-muted text-tiny px-2 py-1">{t('inspector.noShot')}</p>
      </PropertySection>
    )
  }

  const target = shot.target ?? null

  const bindRail = (pathId: string): void =>
    run(
      editCameraShot(shot.id, {
        motion: pathId === '' ? undefined : { ...WHOLE_RAIL, ...shot.motion, pathId },
      }),
    )

  /** A rail laid where the camera stands, aimed down its line of sight, and bound in one undo. */
  const addRail = (): void => {
    const rail = { ...pathNode(), transform: camera.transform }
    run(
      multi(`shot:rail:${shot.id}`, [
        addNode(rail),
        editCameraShot(shot.id, { motion: { ...WHOLE_RAIL, pathId: rail.id } }),
      ]),
    )
  }

  const aimAt = (choice: string): void => {
    const chosen: CameraTarget | undefined =
      choice === ''
        ? undefined
        : choice === POINT_TARGET.kind
          ? POINT_TARGET
          : { kind: 'node', nodeId: choice }

    run(editCameraShot(shot.id, { target: chosen }))
  }

  return (
    <PropertySection title={t('inspector.shot')}>
      <label className="flex items-center justify-between gap-2 px-2">
        <span className="text-muted text-tiny">{t('inspector.rail')}</span>
        <select
          value={shot.motion?.pathId ?? ''}
          onChange={event => bindRail(event.target.value)}
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
          onClick={addRail}
        />
      </label>

      {shot.motion && (
        <CameraShotSectionMotion
          motion={shot.motion}
          onChange={motion => run(editCameraShot(shot.id, { motion }))}
          gesture={gesture}
        />
      )}

      <label className="flex items-center justify-between gap-2 px-2">
        <span className="text-muted text-tiny">{t('inspector.target')}</span>
        <select
          value={
            target === null
              ? ''
              : target.kind === POINT_TARGET.kind
                ? POINT_TARGET.kind
                : target.nodeId
          }
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
      </label>

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
