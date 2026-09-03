import { mdiCubeOutline } from '@mdi/js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Row } from '@/components/Row'
import { Tree, type TreeNode } from '@/components/Tree'
import { CollectionBar } from '@/components/CollectionBar/CollectionBar'
import { LIST_ONLY, type CollectionState } from '@/helpers/collectionState'
import { foldTreeBranch } from '@/helpers/treeExpansion'
import type { Command } from '@/engines/core/history'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import { SceneNodeRow } from '@/features/scene/components/Scene/SceneNodeRow'
import { VisibilityToggle } from '@/features/scene/components/VisibilityToggle'
import { canMoveNode, multi, reorderNodes, reparentNode } from '@/engines/scene/commands'
import { commandId } from '@/engines/core/history'
import { openSceneNodeMenu } from '@/features/scene/components/Scene/sceneNodeMenu'
import { runSceneCommand, toggleNodeVisible } from '@/features/scene/components/sceneCommands'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { sceneOf, selectIn, useScenes } from '@/stores/scenes'
import { useTreeFolds } from '@/stores/treeFolds'
import { sceneNodeDrag } from '../dragged'

/** The synthetic root. It is not a node: it has no transform, no visibility and no delete. */
const SCENE_ROOT = 'scene-root'

type SceneItem = TreeNode & { node: SceneNode | null }

export function SceneTree({ documentId }: { documentId: string }) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  // Folding is session state: nobody wants Cmd-Z to give them back a collapsed branch.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set([SCENE_ROOT]))
  const [collection, setCollection] = useState<CollectionState>({ ...LIST_ONLY, sort: 'name' })
  // Which row has its name open, held here rather than in the row: the menu that opens one sits
  // at this level, and a memoized row cannot be told to open itself from outside.
  const [renaming, setRenaming] = useState<string | null>(null)
  // Stable across renders, and that is the point: bound per row they would hand every line a new
  // prop on every render of the tree — a drag fires one per frame — and the memo on the row could
  // never match again.
  const openRename = useCallback((id: string) => setRenaming(id), [])
  const closeRename = useCallback(() => setRenaming(null), [])
  // A group opens the first time it is seen, and can be folded afterwards: made by ⌘G it would
  // otherwise swallow the very nodes just put into it, and the outliner would look like it had
  // lost them. Folding it again has to stick, so this happens once per group and not per render.
  const known = useRef(new Set<string>())
  useEffect(() => {
    const fresh = nodes.filter(node => node.type === 'group' && !known.current.has(node.id))
    if (fresh.length === 0) return

    for (const group of fresh) known.current.add(group.id)
    setExpandedIds(current => new Set([...current, ...fresh.map(group => group.id)]))
  }, [nodes])

  const items = useMemo<SceneItem[]>(
    () => [
      { id: SCENE_ROOT, parentId: null, node: null },
      ...nodes.map(node => ({ id: node.id, parentId: node.parentId ?? SCENE_ROOT, node })),
    ],
    [nodes],
  )

  const shownItems = useMemo<SceneItem[]>(() => {
    const term = collection.search.trim().toLocaleLowerCase(language)
    const kept = new Set<string>([SCENE_ROOT])
    const byId = new Map(items.map(item => [item.id, item]))

    for (const item of items) {
      if (!item.node || (term && !item.node.name.toLocaleLowerCase(language).includes(term))) {
        continue
      }
      for (let current: SceneItem | undefined = item; current;) {
        kept.add(current.id)
        current = current.parentId ? byId.get(current.parentId) : undefined
      }
    }

    const descending = collection.sort === 'nameDesc'
    return items
      .filter(item => term === '' || kept.has(item.id))
      .sort((one, other) => {
        if (!one.node || !other.node) return one.node ? 1 : other.node ? -1 : 0
        const order = one.node.name.localeCompare(other.node.name, language)
        return descending ? -order : order
      })
  }, [collection.search, collection.sort, items, language])

  const expandableIds = useMemo(() => {
    const parents = new Set(shownItems.flatMap(item => (item.parentId ? [item.parentId] : [])))
    return new Set(shownItems.filter(item => parents.has(item.id)).map(item => item.id))
  }, [shownItems])
  const anyExpanded = [...expandableIds].some(id => expandedIds.has(id))
  const foldOrder = useTreeFolds(state => state.scene)
  const seenFoldOrder = useRef(foldOrder.stamp)
  useEffect(() => useTreeFolds.getState().note('scene', anyExpanded), [anyExpanded])
  useEffect(() => {
    if (seenFoldOrder.current === foldOrder.stamp) return
    seenFoldOrder.current = foldOrder.stamp
    setExpandedIds(foldOrder.wanted ? new Set(expandableIds) : new Set())
  }, [expandableIds, foldOrder.stamp, foldOrder.wanted])

  const toggle = useCallback(
    (id: string) => {
      setExpandedIds(current => {
        const next = new Set(current)
        if (!next.delete(id)) {
          next.add(id)
          return next
        }
        return foldTreeBranch(items, current, id)
      })
    },
    [items],
  )

  /**
   * What the two halves of the drag share: where the batch aims, and opening what it lands in.
   * ONE entry in the history for the whole of it — six objects filed into a group cost one ⌘Z.
   *
   * The batch is handed to `build` WHOLE and never one member at a time: an insertion counts the
   * level once they have ALL left it, so a command per member would count the ones still in
   * place as siblings.
   */
  const move = (
    ids: readonly string[],
    parentId: string | null,
    build: (batch: readonly string[], wanted: string | null) => Command<SceneState> | null,
  ): void => {
    const wanted = parentId === SCENE_ROOT ? null : parentId
    const allowed = ids.filter(id => canMoveNode(nodes, id, wanted))
    const command = allowed.length === 0 ? null : build(allowed, wanted)
    if (!command) return

    useScenes.getState().runCommand(documentId, command)
    // Opened, or the nodes just moved would vanish into a folded branch.
    if (wanted) setExpandedIds(current => new Set(current).add(wanted))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CollectionBar
        scId="scene"
        state={collection}
        onChange={setCollection}
        sorts={[
          { value: 'name', label: t('explorer.sort.name') },
          { value: 'nameDesc', label: t('explorer.sort.nameDesc') },
        ]}
        layout="inline"
        display={false}
      />
      <div className="min-h-0 flex-1">
        <Tree
          nodes={shownItems}
          label={t('panels.scene')}
          selectedIds={selectedIds}
          expandedIds={expandedIds}
          // The root is a row but not a node: clicking it selects nothing, and a range that spans
          // it steps over it rather than selecting a thing the scene has never heard of.
          selectable={item => item.node !== null}
          // Taking hold of a row already picked takes the whole selection with it: six objects filed
          // into a group in one gesture, which is the reason anyone selects six. A row OUTSIDE the
          // selection travels alone and leaves it whole — see `batchFrom`.
          dragMultiple
          // Dropped ONTO a row, which hangs the batch from it — the root standing for the scene, so
          // that is also how a node comes back out of a group.
          onDrop={(ids, parentId) =>
            move(ids, parentId, (batch, wanted) => {
              // Refused here rather than by the command: a row dropped back where it came from is the
              // commonest gesture of the drag, and it would leave a dead entry in the history.
              const moving = batch.filter(
                id => nodes.find(one => one.id === id)?.parentId !== wanted,
              )
              return moving.length === 0
                ? null
                : multi(
                    commandId('reparent', moving),
                    moving.map(id => reparentNode(id, wanted)),
                  )
            })
          }
          // Dropped BETWEEN two rows, which gives the node a PLACE in a level — what every 3D
          // outliner does and what the middle of a row cannot say. `Tree` offers none beside the
          // root: that row stands for the scene, which has no siblings.
          onInsert={(ids, parentId, index) =>
            move(ids, parentId, (batch, wanted) => reorderNodes(batch, wanted, index))
          }
          // A second channel beside the tree's own, which reparents: this one is what the animation
          // band reads to put an object on itself. The tree knows nothing of it, and it knows nothing
          // of the tree — see `onDragStart` on `Tree`.
          onDragStart={(item, event) => {
            if (!item.node) return
            // The whole selection when the row dragged is part of it, so six objects land in one
            // gesture; the row alone otherwise, which is what dragging an unselected row means.
            sceneNodeDrag.start(
              event,
              selectedIds.includes(item.node.id) ? selectedIds : [item.node.id],
            )
          }}
          onSelect={(ids, mode) => selectIn(documentId, ids, mode)}
          onToggle={toggle}
          // Through the tree rather than from the row, as the layer stack does: it holds the
          // `preventDefault` a right-click needs — without it the system raises its clipboard menu
          // over ours — and the guard that leaves a right-click inside the rename field to that one.
          // The root answers nothing: it stands for the scene, which has no name and no delete.
          // The row is already armed here: `Tree` picks on pointer down, which fires before this.
          onContextMenu={item => {
            if (!item.node) return
            const node = item.node
            openSceneNodeMenu({
              node,
              canFrame: sceneEngineOf(documentId) !== undefined,
              t,
              run: command => runSceneCommand(documentId, command),
              onToggleVisible: () => toggleNodeVisible(documentId, node.id),
              onSheet: sceneOf(useScenes.getState(), documentId).animation.sheet.includes(node.id),
              onRename: () => openRename(node.id),
            })
          }}
          // Pinned to the RIGHT edge, outside the indentation, as the layer stack pins its own: the
          // eyes read as one straight column, and the left of the panel is left to the shape of the
          // tree. The synthetic root answers nothing — it stands for the scene, which cannot be
          // hidden — and `Tree` holds the column open at one width for every row.
          renderTrailing={({ node: item }) =>
            item.node && (
              <VisibilityToggle
                visible={item.node.visible}
                label={t('scene.visible')}
                onToggle={() => toggleNodeVisible(documentId, item.id)}
              />
            )
          }
          renderRow={({ node: item }) =>
            item.node ? (
              <SceneNodeRow
                documentId={documentId}
                node={item.node}
                renameLabel={t('scene.rename')}
                renaming={renaming === item.id}
                onRename={openRename}
                onRenamed={closeRename}
              />
            ) : (
              <Row icon={mdiCubeOutline} title={t('scene.root')} />
            )
          }
        />
      </div>
    </div>
  )
}
