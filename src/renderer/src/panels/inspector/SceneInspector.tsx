import { mdiTuneVariant } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { setGeometryOn, setLightOn, setMaterialOn } from '@/engines/scene/commands'
import { geometryFields, lightFields } from '@/engines/scene/property-fields'
import { selectedNodes } from '@/engines/scene/scene-state'
import { changedFields } from '@/helpers/objects'
import { useToken } from '@/hooks/useToken'
import { sceneOf, useScenes } from '@/stores/scenes'
import { DescriptorSection } from './DescriptorSection'
import { MaterialSection } from './MaterialSection'
import { TransformSection } from './TransformSection'
import { useSceneEdit } from './useSceneEdit'

export type SceneInspectorProps = { documentId: string }

/**
 * Everything that defines the selected nodes, and lets them be played with.
 *
 * The anchor — the last node picked — is what the fields read out; typing into one writes the
 * value onto every selected node built the same way, as one entry in the history. Which nodes
 * those are is a rule about the scene, so it lives in the commands rather than here. The name is
 * the one field that stays on the anchor: three nodes of one name is not a rename.
 *
 * One face of the inspector rather than the whole of it: which document is in front is decided
 * by `Inspector`.
 */
export function SceneInspector({ documentId }: SceneInspectorProps) {
  const { t } = useTranslation()
  // Two stable selectors, then derived: a selector that builds an array hands React a new
  // snapshot on every call, and the render loop never settles.
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  const selection = useMemo(() => selectedNodes(nodes, selectedIds), [nodes, selectedIds])
  const node = selection.at(-1) ?? null

  const edit = useSceneEdit(documentId)
  // Cached per theme, not per render: this component re-renders on every frame of a drag.
  const meshColor = useToken('--color-mesh')

  const mesh = node?.type === 'mesh' ? node : null
  const light = node?.type === 'light' ? node : null
  // The descriptors keep their identity across every edit that does not touch them, so the
  // fields of a material survive a whole drag of the position.
  const geometry = useMemo(() => (mesh ? geometryFields(mesh.geometry) : []), [mesh])
  const lit = useMemo(() => (light ? lightFields(light.light) : []), [light])

  if (!node) return <EmptyState icon={mdiTuneVariant} message={t('inspector.noSelection')} />

  return (
    <>
      <TransformSection node={node} selection={selection} edit={edit} />

      {mesh && (
        <>
          <DescriptorSection
            title={t('inspector.geometry')}
            fields={geometry}
            onChange={(name, value) =>
              edit.run(setGeometryOn(selection, mesh.geometry, name, value))
            }
            gesture={edit.gesture}
          />
          <MaterialSection
            material={mesh.material}
            fallbackColor={meshColor}
            onChange={material =>
              edit.run(setMaterialOn(selection, changedFields(mesh.material, material)))
            }
            gesture={edit.gesture}
          />
        </>
      )}

      {light && (
        <DescriptorSection
          title={t('inspector.light')}
          fields={lit}
          onChange={(name, value) => edit.run(setLightOn(selection, light.light, name, value))}
          gesture={edit.gesture}
        />
      )}
    </>
  )
}
