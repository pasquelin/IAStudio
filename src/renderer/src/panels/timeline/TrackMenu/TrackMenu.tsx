import { ContextMenu } from '@/design/ContextMenu'
import { TrackMenuRows, type TrackMenuRowsProps } from './TrackMenuRows'

/** The same rows, at the pointer. */
export function TrackMenu({ at, ...rows }: TrackMenuRowsProps & { at: { x: number; y: number } }) {
  return (
    <ContextMenu at={at} onClose={rows.onClose}>
      <TrackMenuRows {...rows} />
    </ContextMenu>
  )
}
