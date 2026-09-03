import { offerBlankDrop } from '@/helpers/drag'
import type { TreeNode } from './treeTypes'
import { rowDrag } from './rowDrag'
import { TreeViewRow } from './TreeViewRow'
import type { TreeViewState } from './treeViewTypes'

export type TreeViewProps<T extends TreeNode> = { state: TreeViewState<T> }

export function TreeView<T extends TreeNode>({ state }: TreeViewProps<T>) {
  const {
    scroller,
    reducing: reducingRef,
    onSelect,
    onContextMenuRoot,
    setOver,
    foreign,
    onDropRoot,
    setDragged,
    label,
    virtualizer,
  } = state
  return (
    <div
      ref={scroller}
      className="h-full overflow-auto p-2"
      onPointerDownCapture={() => {
        reducingRef.current = null
      }}
      onPointerCancelCapture={() => {
        reducingRef.current = null
      }}
      onPointerDown={event => {
        if (event.target === event.currentTarget) onSelect([], 'replace')
      }}
      onContextMenu={event => {
        if (!onContextMenuRoot || event.target !== event.currentTarget) return
        event.preventDefault()
        onSelect([], 'replace')
        onContextMenuRoot()
      }}
      onDragOver={event => {
        if (event.target !== event.currentTarget) return
        setOver(null)
        offerBlankDrop(event, {
          copies: foreign?.carries(event) ?? false,
          moves: onDropRoot !== undefined && rowDrag.carries(event),
        })
      }}
      onDrop={event => {
        if (event.target !== event.currentTarget) return
        if (foreign?.carries(event)) {
          event.preventDefault()
          setOver(null)
          foreign.onDrop(event, null)
          return
        }
        if (!onDropRoot) return
        event.preventDefault()
        setOver(null)
        setDragged(null)
        const carried = rowDrag.idsFrom(event)
        if (carried.length > 0) onDropRoot(carried)
      }}
    >
      <ul
        role="tree"
        aria-label={label}
        style={{ height: virtualizer.getTotalSize() }}
        className="relative"
      >
        {virtualizer.getVirtualItems().map(virtual => {
          const row = state.slots[virtual.index]
          const key = row?.node.id ?? 'gap'
          return <TreeViewRow key={key} state={state} virtual={virtual} />
        })}
      </ul>
    </div>
  )
}
