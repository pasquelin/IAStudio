import type { CommandId } from '@shared/domain/command'
import { runHistoryCommand } from '@/services/historyCommand'
import { guiStore } from '@/stores/gui'

/** The commands of an interface, reached the same way from the tab and from a headless run. */
export const runGuiCommand = (documentId: string, command: CommandId): boolean =>
  runHistoryCommand(guiStore, 'gui', documentId, command) ?? false
