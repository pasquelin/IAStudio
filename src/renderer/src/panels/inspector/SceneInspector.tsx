import { mdiTuneVariant } from '@mdi/js'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { token } from '@/engines/core/palette'
import { setGeometry, setLight, setMaterial } from '@/engines/scene/commands'
import { geometryFields, lightFields, withField } from '@/engines/scene/property-fields'
import { selectedNode } from '@/engines/scene/scene-state'
import { sceneOf, useScenes } from '@/stores/scenes'
import { DescriptorSection } from './DescriptorSection'
import { MaterialSection } from './MaterialSection'
import { TransformSection } from './TransformSection'
import { useSceneEdit } from './useSceneEdit'

export type SceneInspectorProps = { documentId: string }

/**
 * Everything that defines the selected node, and lets it be played with.
 *
 * One face of the inspector rather than the whole of it: which document is in front, and
 * whether anything is selected at all, is decided by `Inspector`.
 */
export function SceneInspector({ documentId }: SceneInspectorProps) {
  const { t } = useTranslation()
  // The node itself, not a copy: `nodeById` hands back what the state holds, so a selection
  // that changed nothing else gives React the same reference and nothing re-renders.
  const node = useScenes(state => selectedNode(sceneOf(state, documentId)))
  const edit = useSceneEdit(documentId)
  // Frozen on mount: `getComputedStyle` is not something to call on every frame of a drag.
  const [meshColor] = useState(() => token(document.body, '--color-mesh'))

  const mesh = node?.type === 'mesh' ? node : null
  const light = node?.type === 'light' ? node : null
  // The descriptors keep their identity across every edit that does not touch them, so the
  // fields of a material survive a whole drag of the position.
  const geometry = useMemo(() => (mesh ? geometryFields(mesh.geometry) : []), [mesh])
  const lit = useMemo(() => (light ? lightFields(light.light) : []), [light])

  if (!node) return <EmptyState icon={mdiTuneVariant} message={t('inspector.noSelection')} />

  return (
    <>
      <TransformSection node={node} edit={edit} />

      {mesh && (
        <>
          <DescriptorSection
            title={t('inspector.geometry')}
            fields={geometry}
            onChange={(name, value) =>
              edit.run(setGeometry(mesh.id, withField(mesh.geometry, name, value)))
            }
            gesture={edit.gesture}
          />
          <MaterialSection
            material={mesh.material}
            fallbackColor={meshColor}
            onChange={material => edit.run(setMaterial(mesh.id, material))}
            gesture={edit.gesture}
          />
        </>
      )}

      {light && (
        <DescriptorSection
          title={t('inspector.light')}
          fields={lit}
          onChange={(name, value) =>
            edit.run(setLight(light.id, withField(light.light, name, value)))
          }
          gesture={edit.gesture}
        />
      )}
    </>
  )
}
