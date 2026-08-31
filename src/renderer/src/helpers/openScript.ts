import { refFromString } from '@shared/domain/ref'
import { openDocument } from '@/features/shell/components/dockviewApi'
import { useCode } from '@/stores/code'
import { documentAtPath, useDocuments } from '@/stores/documents'

/** Brings a script's tab forward and puts the cursor on that line. Here rather than in the store:
 * the centre is reached through `dockviewApi`, which a store must not import. */
export function openScriptAt(script: string, line: number, column: number): void {
  const ref = refFromString(script)
  if (ref?.kind !== 'script') return

  // 🛑 No tab, no cursor: only a mounted `ScriptDocument` clears `goto`, so one posted for a
  // script the project does not hold stays armed — and jumps the caret the day it is opened.
  const document = documentAtPath(useDocuments.getState(), ref.path)
  if (!document) return

  openDocument(document)
  useCode.getState().goTo(script, line, column)
}
