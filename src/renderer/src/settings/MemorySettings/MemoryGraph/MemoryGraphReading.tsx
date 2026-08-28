import { useTranslation } from 'react-i18next'
import type { MemoryType } from '@shared/domain/assistantMemory'
import type { PlacedNode } from '@/engines/memory/memoryLayout'
import { WINDOW_CAPTION } from '@/design/windowStyles'
import { cn } from '@/helpers/cn'

/**
 * What the dot under the pointer says.
 *
 * 🛑 The line keeps its room whether or not anything is hovered: a graph whose caption appears
 * and disappears reflows the panel under the pointer, and the dot the reader was aiming at moves.
 */
export function MemoryGraphReading({ node }: { node: PlacedNode | null }) {
  const { t } = useTranslation()

  return (
    <p className={cn(WINDOW_CAPTION, 'min-h-4 truncate text-right')}>
      {node === null ? '' : `${t(`memoryTypes.${node.type as MemoryType}`)} · ${node.label}`}
    </p>
  )
}
