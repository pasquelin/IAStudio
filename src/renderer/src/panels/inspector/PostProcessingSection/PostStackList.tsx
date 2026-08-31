import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { planStack, type PostEffect, type PostStack } from '@shared/domain/postProcessing'
import { Tree } from '@/components/Tree'
import { VisibilityToggle } from '@/panels/shared/VisibilityToggle'
import { PostStackRow } from './PostStackRow'

/** A `TreeNode` over one effect. Flat: a composition has no depth, only an order. */
type EffectNode = { id: string; parentId: null; effect: PostEffect }

export type PostStackListProps = {
  stack: PostStack
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (order: readonly string[]) => void
  onToggle: (id: string, enabled: boolean) => void
  /** Stable, all four: a fresh arrow per row would defeat `PostStackRow`'s own memo. */
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onReset: (id: string) => void
}

/**
 * The same `Tree` the layer stack and the outliner use. FLAT: a stack has an order and no depth,
 * so every node hangs from the root and `onInsert` is the only drop that means anything.
 */
export function PostStackList({
  stack,
  selectedId,
  onSelect,
  onReorder,
  onToggle,
  onRemove,
  onDuplicate,
  onReset,
}: PostStackListProps) {
  const { t } = useTranslation()

  const nodes = useMemo<EffectNode[]>(
    () => stack.effects.map(effect => ({ id: effect.id, parentId: null, effect })),
    [stack.effects],
  )
  // What the plan actually runs, so a row the order or the slots leave out can say so rather
  // than showing a switch that is on and does nothing.
  const skipped = useMemo(() => new Set(planStack(stack).skipped.map(effect => effect.id)), [stack])

  const moved = (id: string, index: number): readonly string[] => {
    const order = stack.effects.map(effect => effect.id).filter(other => other !== id)
    return [...order.slice(0, index), id, ...order.slice(index)]
  }

  return (
    <Tree
      nodes={nodes}
      label={t('postfx.stack')}
      selectedIds={selectedId ? [selectedId] : []}
      // Nothing nests, so nothing folds: the set is empty and no row is ever expandable.
      expandedIds={EXPANDED_NONE}
      expandable={() => false}
      onToggle={() => {}}
      onSelect={ids => {
        const id = ids.at(-1)
        if (id) onSelect(id)
      }}
      // Only between rows: dropping INTO an effect would mean nesting one inside another, and a
      // composition is a sequence.
      onInsert={(ids, _parentId, index) => {
        const id = ids[0]
        if (id) onReorder(moved(id, index))
      }}
      renderTrailing={row => (
        <VisibilityToggle
          visible={row.node.effect.enabled}
          label={t('postfx.toggleEffect')}
          onToggle={() => onToggle(row.node.id, !row.node.effect.enabled)}
        />
      )}
      renderRow={row => (
        <PostStackRow
          effect={row.node.effect}
          skipped={skipped.has(row.node.id)}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
          onReset={onReset}
        />
      )}
    />
  )
}

/** Shared, since a fresh empty set on each render would hand the tree a new snapshot per frame. */
const EXPANDED_NONE: ReadonlySet<string> = new Set()
