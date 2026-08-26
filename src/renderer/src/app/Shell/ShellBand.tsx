import { useCallback } from 'react'
import { ResizeHandle } from '@/design/ResizeHandle'
import { cn } from '@/helpers/cn'
import { useTools } from '@/stores/tools'
import { ShellEdge } from './ShellEdge'

export type ShellBandProps = {
  /** Whether that half of the band draws anything — the shell has already asked. */
  left: boolean
  right: boolean
}

/**
 * The bottom band: one strip, one height, and up to two zones side by side.
 *
 * Alone, a half takes the whole strip — and the shell has already run it under the opposite
 * column. Together they share the width, parted by a handle that starts at the middle.
 */
export function ShellBand({ left, right }: ShellBandProps) {
  const split = useTools(state => state.lengths.bandSplit)

  const resplit = useCallback(
    (size: number, available: number) => useTools.getState().resplitBand(size, available),
    [],
  )

  if (!left && !right) return null
  if (!left || !right) return <ShellEdge zone={left ? 'bottomLeft' : 'bottomRight'} />

  return (
    <div className="flex min-h-0">
      {/* Undefined until dragged: both halves are then flex and the strip parts in the middle. */}
      <div
        className={cn('flex min-w-0 flex-col', split === undefined && 'flex-1')}
        style={split === undefined ? undefined : { width: split }}
      >
        <ShellEdge zone="bottomLeft" />
      </div>

      <ResizeHandle axis="horizontal" size={split} onSize={resplit} />

      <div className="flex min-w-0 flex-1 flex-col">
        <ShellEdge zone="bottomRight" />
      </div>
    </div>
  )
}
