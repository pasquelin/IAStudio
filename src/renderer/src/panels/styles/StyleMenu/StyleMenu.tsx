import { ContextMenu } from '@/design/ContextMenu'
import { StyleMenuRows, type StyleMenuRowsProps } from './StyleMenuRows'

/** The same rows, at the pointer. */
export function StyleMenu({
  id,
  at,
  onRename,
  onClose,
}: StyleMenuRowsProps & { at: { x: number; y: number } }) {
  return (
    <ContextMenu at={at} onClose={onClose}>
      <StyleMenuRows id={id} onRename={onRename} onClose={onClose} />
    </ContextMenu>
  )
}
