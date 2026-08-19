import { ContextMenu } from '@/design/ContextMenu'
import { StylesSectionMenuRows, type StylesSectionMenuRowsProps } from './StylesSectionMenuRows'

/** The same rows, at the pointer. */
export function StylesSectionMenu({
  id,
  at,
  onRename,
  onClose,
}: StylesSectionMenuRowsProps & { at: { x: number; y: number } }) {
  return (
    <ContextMenu at={at} onClose={onClose}>
      <StylesSectionMenuRows id={id} onRename={onRename} onClose={onClose} />
    </ContextMenu>
  )
}
