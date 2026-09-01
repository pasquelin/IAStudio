import type { CommandId } from '@shared/domain/command'
import { useGuis } from '@/stores/gui'

/** The commands of an interface, reached the same way from the tab and from a headless run. */
export function runGuiCommand(documentId: string, command: CommandId): boolean {
  const store = useGuis.getState()
  if (command === 'gui.undo') {
    store.undo(documentId)
    return true
  }
  if (command === 'gui.redo') {
    store.redo(documentId)
    return true
  }
  return false
}
