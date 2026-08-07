import { mdiTuneVariant } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { token } from '@/engines/core/palette'
import { setGeometry, setLight, setMaterial } from '@/engines/scene/commands'
import { geometryFields, lightFields, withField } from '@/engines/scene/property-fields'
import { nodeById, type SceneNode } from '@/engines/scene/scene-state'
import { activeIdOfKind, useDocuments, type DocumentsSlice } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import { DescriptorSection } from './DescriptorSection'
import { MaterialSection } from './MaterialSection'
import { TransformSection } from './TransformSection'
import { useSceneEdit } from './useSceneEdit'

const activeSceneId = (state: DocumentsSlice): string | null => activeIdOfKind(state, 'scene')

/**
 * The colour the viewport paints an untextured mesh with, for a material that carries none.
 * Read off the document rather than written down: the token is declared once, in `index.css`.
 */
function useMeshColor(): string {
  const [color] = useState(() => token(document.body, '--color-mesh'))
  return color
}

/** Everything that defines the selected node, and lets it be played with. */
export function Inspector() {
  const { t } = useTranslation()
  const documentId = useDocuments(activeSceneId)

  if (!documentId) {
    return <EmptyState icon={mdiTuneVariant} message={t('inspector.noDocument')} />
  }
  return <SelectedNode documentId={documentId} />
}

function SelectedNode({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  // The node itself, not a copy: `nodeById` hands back what the state holds, so a selection
  // that changed nothing else gives React the same reference and nothing re-renders.
  const node = useScenes(state => selectedNode(sceneOf(state, documentId)))
  const edit = useSceneEdit(documentId)
  const meshColor = useMeshColor()

  if (!node) return <EmptyState icon={mdiTuneVariant} message={t('inspector.noSelection')} />

  return (
    <div className="h-full overflow-y-auto">
      <TransformSection node={node} edit={edit} />

      {node.type === 'mesh' ? (
        <>
          <DescriptorSection
            title={t('inspector.geometry')}
            fields={geometryFields(node.geometry)}
            onChange={(name, value) =>
              edit.run(setGeometry(node.id, withField(node.geometry, name, value)))
            }
            gesture={edit}
          />
          <MaterialSection
            material={node.material}
            fallbackColor={meshColor}
            onChange={material => edit.run(setMaterial(node.id, material))}
            gesture={edit}
          />
        </>
      ) : (
        <DescriptorSection
          title={t('inspector.light')}
          fields={lightFields(node.light)}
          onChange={(name, value) =>
            edit.run(setLight(node.id, withField(node.light, name, value)))
          }
          gesture={edit}
        />
      )}
    </div>
  )
}

function selectedNode(scene: { nodes: SceneNode[]; selectedId: string | null }): SceneNode | null {
  return scene.selectedId ? nodeById(scene, scene.selectedId) : null
}
