import { useCallback } from 'react'
import { cn } from '@/helpers/cn'
import { useToolSurface } from '@/stores/layouts'
import { DEFAULT_SIZES, DEFAULT_SPLIT, sizeKeyOf, useTools } from '@/stores/tools'
import { ResizeHandle } from '@/design/ResizeHandle'
import { isHorizontal, isLeading, type ToolZone } from '@shared/domain/tool'
import { useShownTools } from '@/hooks/useShownTools'
import { ToolWindow } from '../ToolWindow'

/**
 * A zone's two halves and its resize handle, ordered by the zone. `left` and `top` put the
 * panels first; the opposite zones put the handle first, because they grow backwards.
 */
export function ShellEdge({ zone }: { zone: ToolZone }) {
  const surface = useToolSurface()

  // Stable across the whole drag, so the memoized panels skip a size change entirely.
  const focusZone = useCallback(() => useTools.getState().focus(zone), [zone])
  const closePrimary = useCallback(
    () => useTools.getState().close(surface, zone, 'primary'),
    [surface, zone],
  )
  const closeSecondary = useCallback(
    () => useTools.getState().close(surface, zone, 'secondary'),
    [surface, zone],
  )

  const size = useTools(state => state.lengths.sizes[sizeKeyOf(zone)] ?? DEFAULT_SIZES[zone])
  const split = useTools(state => state.lengths.splits[zone] ?? DEFAULT_SPLIT)

  const { primary, secondary } = useShownTools(zone)
  if (!primary && !secondary) return null

  // Actions are stable for the store's lifetime: subscribing to them would only add
  // selectors re-run on every write.
  const { resize, resplit } = useTools.getState()
  const lying = isHorizontal(zone)

  const panel = (
    <div
      // No gap: the handle between the two halves already occupies the gutter, exactly as the
      // zone handles do outside. Adding one here spaces them by three gutters.
      className={cn('flex min-h-0 min-w-0', lying ? 'flex-row' : 'flex-col')}
      style={{ [lying ? 'height' : 'width']: size }}
    >
      {primary && (
        <ToolWindow tool={primary} zone={zone} onFocus={focusZone} onClose={closePrimary} />
      )}

      {/* Only between two open halves: a lone panel has nothing to be dragged against. */}
      {primary && secondary && (
        <ResizeHandle
          axis={lying ? 'horizontal' : 'vertical'}
          invert
          size={split}
          onSize={(value, available) => resplit(zone, value, available)}
        />
      )}

      {secondary && (
        <ToolWindow
          tool={secondary}
          zone={zone}
          // The second half keeps a length of its own only while the first is there to take the
          // rest; alone, it fills the zone.
          length={primary ? split : undefined}
          onFocus={focusZone}
          onClose={closeSecondary}
        />
      )}
    </div>
  )
  const handle = (
    <ResizeHandle
      axis={lying ? 'vertical' : 'horizontal'}
      invert={!isLeading(zone)}
      size={size}
      onSize={(value, available) => resize(zone, value, available)}
    />
  )

  return isLeading(zone) ? (
    <>
      {panel}
      {handle}
    </>
  ) : (
    <>
      {handle}
      {panel}
    </>
  )
}
