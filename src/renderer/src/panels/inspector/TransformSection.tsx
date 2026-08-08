import { useTranslation } from 'react-i18next'
import { toDegrees, toRadians } from '@shared/domain/angles'
import type { Transform, Vector3 } from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'
import { TextField } from '@/design/TextField'
import { VectorField } from '@/design/VectorField'
import { batch, renameNode, setTransform } from '@/engines/scene/commands'
import type { SceneNode } from '@/engines/scene/scene-state'
import { changedFields } from '@/helpers/objects'
import type { SceneEdit } from './useSceneEdit'

/** A field reports a whole vector; this is the axes of it that actually moved. */
type AxisPatch = { [K in keyof Transform]?: Partial<Vector3> }

const AXES: readonly (keyof Vector3)[] = ['x', 'y', 'z']

function degreesOf(vector: Vector3): Vector3 {
  return { x: toDegrees(vector.x), y: toDegrees(vector.y), z: toDegrees(vector.z) }
}

function radiansOf(axes: Partial<Vector3>): Partial<Vector3> {
  const out: Partial<Vector3> = {}
  for (const axis of AXES) {
    const value = axes[axis]
    if (value !== undefined) out[axis] = toRadians(value)
  }
  return out
}

function patched(target: Transform, patch: AxisPatch): Transform {
  return {
    position: { ...target.position, ...patch.position },
    rotation: { ...target.rotation, ...patch.rotation },
    scale: { ...target.scale, ...patch.scale },
  }
}

export type TransformSectionProps = {
  /** The anchor: what the fields read out, and the only node the name applies to. */
  node: SceneNode
  /** What a moved axis writes to — the anchor included. */
  selection: readonly SceneNode[]
  edit: SceneEdit
}

/**
 * Where the node is, how it is turned and how big it is — the section every node has, mesh or
 * light. A light without it could only be placed by dragging the gizmo, which is no way to put
 * a key light exactly where the last one stood.
 *
 * A typed value is absolute and lands on every selected node, but only on the axis touched: three
 * cubes given a height keep the columns they stand in. A gizmo drag is the relative gesture, and
 * it goes through the viewport rather than through here.
 */
export function TransformSection({ node, selection, edit }: TransformSectionProps) {
  const { t } = useTranslation()
  const { transform } = node
  const degrees = degreesOf(transform.rotation)

  const move = (patch: AxisPatch): void =>
    edit.run(
      batch('transform', selection, candidate =>
        setTransform(candidate.id, patched(candidate.transform, patch)),
      ),
    )

  return (
    <PropertySection title={t('inspector.transform')}>
      <TextField
        label={t('inspector.name')}
        value={node.name}
        onChange={name => edit.run(renameNode(node.id, name))}
        {...edit.gesture}
      />

      <VectorField
        label={t('inspector.position')}
        value={transform.position}
        step={0.1}
        onChange={next => move({ position: changedFields(transform.position, next) })}
        {...edit.gesture}
      />

      <VectorField
        label={t('inspector.rotation')}
        value={degrees}
        step={1}
        // Diffed in degrees, which is the unit the field reports: converting back to radians
        // first leaves the untouched axes a few ulps off, and those would then be written —
        // as the anchor's own angle — onto every other node of the selection.
        onChange={next => move({ rotation: radiansOf(changedFields(degrees, next)) })}
        {...edit.gesture}
      />

      <VectorField
        label={t('inspector.scale')}
        value={transform.scale}
        step={0.1}
        onChange={next => move({ scale: changedFields(transform.scale, next) })}
        {...edit.gesture}
      />
    </PropertySection>
  )
}
