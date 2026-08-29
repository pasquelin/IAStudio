import { useTranslation } from 'react-i18next'
import type { PlacedNode } from '@/engines/memory/memoryLayout'
import { WINDOW_CAPTION } from '@/design/windowStyles'
import { cn } from '@/helpers/cn'

/**
 * 🛑 The line keeps its room whether or not a dot is hovered: a caption that appears and
 * disappears reflows the panel, and the dot the reader was aiming at moves.
 */
export function MemoryGraphReading({ node }: { node: PlacedNode | null }) {
  const { t } = useTranslation()

  return (
    <p className={cn(WINDOW_CAPTION, 'min-h-4 truncate text-right')}>
      {node === null ? '' : `${t(`memoryTypes.${node.type}`)} · ${node.label}`}
    </p>
  )
}
