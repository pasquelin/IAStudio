import { useTranslation } from 'react-i18next'
import type { Transform, Vector3 } from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'
import { TextField } from '@/design/TextField'
import { Vector3Field } from '@/design/Vector3Field'
import { renameNode, setTransform } from '@/engines/scene/commands'
import type { SceneNode } from '@/engines/scene/scene-state'
import type { SceneEdit } from './useSceneEdit'

/** Radians are what three.js turns and what a document stores; nobody types in them. */
const PER_RADIAN = 180 / Math.PI

function scaled(vector: Vector3, factor: number): Vector3 {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor }
}

/**
 * Where the node is, how it is turned and how big it is — the section every node has, mesh or
 * light. A light without it could only be placed by dragging the gizmo, which is no way to put
 * a key light exactly where the last one stood.
 */
export function TransformSection({ node, edit }: { node: SceneNode; edit: SceneEdit }) {
  const { t } = useTranslation()
  const { transform } = node
  const gesture = { onGestureStart: edit.onGestureStart, onGestureEnd: edit.onGestureEnd }

  const move = (changes: Partial<Transform>): void =>
    edit.run(setTransform(node.id, { ...transform, ...changes }))

  return (
    <PropertySection title={t('inspector.transform')}>
      <TextField
        label={t('inspector.name')}
        value={node.name}
        onChange={name => edit.run(renameNode(node.id, name))}
        {...gesture}
      />

      <Vector3Field
        label={t('inspector.position')}
        value={transform.position}
        step={0.1}
        onChange={position => move({ position })}
        {...gesture}
      />

      <Vector3Field
        label={t('inspector.rotation')}
        value={scaled(transform.rotation, PER_RADIAN)}
        step={1}
        onChange={degrees => move({ rotation: scaled(degrees, 1 / PER_RADIAN) })}
        {...gesture}
      />

      <Vector3Field
        label={t('inspector.scale')}
        value={transform.scale}
        step={0.1}
        onChange={scale => move({ scale })}
        {...gesture}
      />
    </PropertySection>
  )
}
