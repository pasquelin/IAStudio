import type { CommandId } from '@shared/domain/command'
import { useMaterials } from '@/stores/materials'

/** The commands of a material, reached the same way from the tab and from a headless run. */
export function runMaterialCommand(documentId: string, command: CommandId): boolean {
  const store = useMaterials.getState()
  if (command === 'material.undo') {
    store.undo(documentId)
    return true
  }
  if (command === 'material.redo') {
    store.redo(documentId)
    return true
  }
  return false
}
