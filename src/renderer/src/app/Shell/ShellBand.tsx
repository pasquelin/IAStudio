import { useCallback, useRef } from 'react'
import { ResizeHandle } from '@/design/ResizeHandle'
import { cn } from '@/helpers/cn'
import { useElementWidth } from '@/hooks/useElementWidth'
import { useToolSurface } from '@/stores/layouts'
import { arrangementOf, useTools } from '@/stores/tools'
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
  const surface = useToolSurface()
  const bandSplit = useTools(state => arrangementOf(state, surface).bandSplit)
  const band = useRef<HTMLDivElement>(null)
  const width = useElementWidth(band)

  const resplit = useCallback(
    (size: number, available: number) => useTools.getState().resplitBand(surface, size, available),
    [surface],
  )

  if (!left && !right) return null
  if (!left || !right) return <ShellEdge zone={left ? 'bottomLeft' : 'bottomRight'} />

  // Zero until the observer has answered, and `fitSplit` never lets a real one reach it: the
  // two halves stay evenly spread by flex until there IS a width to take a half of.
  const split = bandSplit ?? Math.round(width / 2)

  return (
    <div ref={band} className="flex min-h-0">
      <div
        className={cn('flex min-w-0 flex-col', split === 0 && 'flex-1')}
        style={split === 0 ? undefined : { width: split }}
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
