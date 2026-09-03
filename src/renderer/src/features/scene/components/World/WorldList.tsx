import { mdiTerrain } from '@mdi/js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/EmptyState'
import { Tree } from '@/components/Tree'
import { VisibilityToggle } from '@/features/scene/components/VisibilityToggle'
import {
  reorderTerrainEdits,
  reorderTerrains,
  setTerrainEditEnabled,
  setTerrainEnabled,
} from '@/engines/scene/reliefCommands'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { WorldRow } from './WorldRow'
import { worldNodeId, worldNodes, type WorldNode } from './worldNodes'

export function WorldList({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const layers = useScenes(state => sceneOf(state, documentId).world.layers)
  const armed = useSceneViews(state => sceneViewOf(state, documentId).armedRelief)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set())
  const known = useRef(new Set<string>())

  const nodes = useMemo(() => worldNodes(layers), [layers])
  const terrains = useMemo(
    () => layers.filter((layer): layer is WorldNode['terrain'] => layer.kind === 'relief'),
    [layers],
  )

  useEffect(() => {
    const fresh = terrains.filter(layer => !known.current.has(layer.id))
    if (fresh.length === 0) return
    for (const layer of fresh) known.current.add(layer.id)
    setExpandedIds(current => new Set([...current, ...fresh.map(layer => layer.id)]))
  }, [terrains])

  const labels = useMemo(
    () => ({
      visible: t('world.visible'),
      show: t('world.showHint'),
      hide: t('world.hideHint'),
      rename: t('world.rename'),
      locks: t('world.locks'),
      locksHint: t('world.locksHint'),
      lockSculpt: t('world.lockSculpt'),
      lockSculptHint: t('world.lockSculptHint'),
      lockPlacement: t('world.lockPlacement'),
      lockPlacementHint: t('world.lockPlacementHint'),
      lockEdit: t('world.lockEdit'),
      lockEditHint: t('world.lockEditHint'),
    }),
    [t],
  )

  if (terrains.length === 0) {
    return <EmptyState icon={mdiTerrain} message={t('world.empty')} />
  }

  const run = useScenes.getState().runCommand
  const selectedId = armed ? worldNodeId(armed.terrainId, armed.editId) : null

  const move = (id: string, parentId: string | null, index: number): void => {
    const node = nodes.find(one => one.id === id)
    if (!node) return
    if (node.kind === 'terrain') {
      if (parentId !== null) return
      const order = terrains
        .map(layer => layer.id)
        .filter(terrainId => terrainId !== node.terrain.id)
      order.splice(index, 0, node.terrain.id)
      run(documentId, reorderTerrains(order))
      return
    }
    const edit = node.edit
    if (!edit || parentId !== node.terrain.id) return
    const order = node.terrain.edits.map(one => one.id).filter(editId => editId !== edit.id)
    order.splice(index, 0, edit.id)
    run(documentId, reorderTerrainEdits(node.terrain.id, order))
  }

  return (
    <Tree
      nodes={nodes}
      label={t('panels.world')}
      selectedIds={selectedId ? [selectedId] : []}
      expandedIds={expandedIds}
      expandable={node => node.kind === 'terrain' && node.terrain.edits.length > 0}
      onToggle={id =>
        setExpandedIds(current => {
          const next = new Set(current)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
      }
      onSelect={ids => {
        const id = ids.at(-1)
        const node = id ? nodes.find(one => one.id === id) : undefined
        useSceneViews
          .getState()
          .setArmedRelief(
            documentId,
            node ? { terrainId: node.terrain.id, editId: node.edit?.id ?? null } : null,
          )
      }}
      droppable={() => false}
      onInsert={(ids, parentId, index) => ids.forEach(id => move(id, parentId, index))}
      renderTrailing={row => {
        const enabled = row.node.edit ? row.node.edit.enabled : row.node.terrain.enabled
        return (
          <VisibilityToggle
            visible={enabled}
            label={labels.visible}
            description={enabled ? labels.hide : labels.show}
            onToggle={() => {
              if (row.node.edit) {
                run(
                  documentId,
                  setTerrainEditEnabled(
                    row.node.terrain.id,
                    row.node.edit.id,
                    !row.node.edit.enabled,
                  ),
                )
                return
              }
              run(documentId, setTerrainEnabled(row.node.terrain.id, !row.node.terrain.enabled))
            }}
          />
        )
      }}
      renderRow={row => (
        <WorldRow
          documentId={documentId}
          node={row.node}
          labels={labels}
          renaming={renaming === row.node.id}
          onRename={() => setRenaming(row.node.id)}
          onRenamed={() => setRenaming(null)}
        />
      )}
    />
  )
}
