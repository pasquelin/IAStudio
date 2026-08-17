import { ContextMenu } from '@/design/ContextMenu'
import { ProjectMenuRows, type ProjectMenuRowsProps } from './ProjectMenuRows'

/** The same rows, at the pointer. */
export function ProjectMenu({
  path,
  at,
  onClose,
  onRename,
}: ProjectMenuRowsProps & { at: { x: number; y: number } }) {
  return (
    <ContextMenu at={at} onClose={onClose}>
      <ProjectMenuRows path={path} onClose={onClose} onRename={onRename} />
    </ContextMenu>
  )
}
