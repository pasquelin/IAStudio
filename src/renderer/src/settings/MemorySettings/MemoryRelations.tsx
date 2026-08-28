import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Memory } from '@shared/domain/assistantMemory'
import { relationsOf, type MemoryRelation } from '@shared/domain/memoryGraph'
import { Tree } from '@/design/Tree'
import { WINDOW_GROUP_LABEL } from '@/design/windowStyles'

/**
 * One hop around the chosen memory: what it points at, what else points there, what it links to
 * and what it replaced.
 *
 * A `Tree` rather than a node-and-link graph — see `memoryGraph.ts`, which states the compromise
 * and where a free layout would have to live if it is ever wanted.
 */

const RELATION_KEYS: Readonly<Record<MemoryRelation, string>> = {
  ref: 'settings.memoryRelationRef',
  link: 'settings.memoryRelationLink',
  supersedes: 'settings.memoryRelationSupersedes',
}

export function MemoryRelations({ memory, among }: { memory: Memory; among: readonly Memory[] }) {
  const { t } = useTranslation()
  const rows = relationsOf(memory, among)
  // Everything open: one hop is small by construction, and a tree that starts folded hides the
  // one thing this view exists to show.
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())

  return (
    <section>
      <h3 className={WINDOW_GROUP_LABEL}>{t('settings.memoryRelations')}</h3>
      <div className="h-40">
        <Tree
          nodes={rows}
          label={t('settings.memoryRelations')}
          selectedIds={[]}
          expandedIds={new Set(rows.filter(one => !folded.has(one.id)).map(one => one.id))}
          onSelect={() => {}}
          onToggle={id =>
            setFolded(held => {
              const next = new Set(held)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          renderRow={({ node }) => (
            <span className="truncate text-xs">
              {node.relation ? `${t(RELATION_KEYS[node.relation])} · ` : ''}
              {node.label}
            </span>
          )}
        />
      </div>
    </section>
  )
}
