import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { setGeometryOn, setLightOn, setMaterialOn, setSpriteOn } from '@/engines/scene/commands'
import { geometryFields, lightFields } from '@/engines/scene/property-fields'
import { selectedNodes } from '@/engines/scene/scene-state'
import { changedFields } from '@/helpers/objects'
import { useToken } from '@/hooks/useToken'
import { sceneOf, useScenes } from '@/stores/scenes'
import { DescriptorSection } from './DescriptorSection'
import { EnvironmentSection } from './EnvironmentSection'
import { MaterialSection } from './MaterialSection'
import { ShadowSection } from './ShadowSection'
import { SpriteSection } from './SpriteSection'
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
  const environment = useScenes(state => sceneOf(state, documentId).environment)
  const selection = useMemo(() => selectedNodes(nodes, selectedIds), [nodes, selectedIds])
  const node = selection.at(-1) ?? null

  const edit = useSceneEdit(documentId)
  // Cached per theme, not per render: this component re-renders on every frame of a drag.
  const meshColor = useToken('--color-mesh')

  const mesh = node?.type === 'mesh' ? node : null
  const light = node?.type === 'light' ? node : null
  const sprite = node?.type === 'sprite' ? node : null
  // The descriptors keep their identity across every edit that does not touch them, so the
  // fields of a material survive a whole drag of the position.
  const geometry = useMemo(() => (mesh ? geometryFields(mesh.geometry) : []), [mesh])
  const lit = useMemo(() => (light ? lightFields(light.light) : []), [light])

  // The environment belongs to the document rather than to a node, so it shows either way — and
  // it is what keeps the panel from being empty when nothing is selected, in place of a message.
  return (
    <>
      <EnvironmentSection environment={environment} edit={edit} />

      {node && (
        <>
          <TransformSection node={node} selection={selection} edit={edit} />
          <ShadowSection node={node} selection={selection} edit={edit} />
        </>
      )}

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

      {sprite && (
        <SpriteSection
          sprite={sprite.sprite}
          fallbackColor={meshColor}
          onChange={next => edit.run(setSpriteOn(selection, changedFields(sprite.sprite, next)))}
          gesture={edit.gesture}
        />
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
