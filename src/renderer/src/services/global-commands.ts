import type { CommandId } from '@shared/domain/command'
import { saveDocument, saveDocumentAs } from '@/app/document-io'
import { reportFailure } from '@/services/diagnostics'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { useTools } from '@/stores/tools'

/**
 * The commands that belong to the application rather than to a document, and how each is run.
 *
 * Apart from the native menu that fires most of them, because it is not the only caller: the
 * assistant reaches the same commands, and a second `switch` beside this one would be two ways
 * of saving a document that drift. `publishCommand` cannot serve them — it is memoryless and
 * filtered by scope on the subscriber's side, and nothing subscribes to these.
 *
 * Answers whether it ran it. `false` covers three things a caller must tell apart from a failure:
 * a command belonging to a surface · the three `global` ones the main process performs on its own,
 * `app.settings`, `app.dictate` and `window.fullScreen`, which never reach the window at all ·
 * and `app.assistant`, which the menu keeps to itself. That last one is not an oversight: the
 * assistant store imports the executor to run a confirmed action, so reaching back into it from
 * here would close the import loop. Nothing is lost — the assistant dismisses itself through
 * `chat.close`, and asking it to toggle the panel it is speaking from has no meaning anyway.
 */
export function runGlobalCommand(command: CommandId): boolean {
  switch (command) {
    case 'layout.reset':
      useTools.getState().reset()
      return true
    case 'project.new':
      void useProject.getState().createPicked()
      return true
    case 'project.open':
      void useProject.getState().openPicked()
      return true
    case 'document.save': {
      // The menu is application-wide and has no idea which tab is in front; the store does.
      const documentId = useDocuments.getState().activeId
      // The tab keeps its marker either way; the log is what says why it kept it.
      if (documentId) {
        void saveDocument(documentId).catch(error =>
          reportFailure('document.save', documentId, error),
        )
      }
      return true
    }
    case 'document.saveAs': {
      const documentId = useDocuments.getState().activeId
      // No `catch` here, unlike Save: `saveDocumentAs` journals its own failures under
      // `assets.copy` and answers false — the shelf the copy would have landed in is where a
      // reader looks for it, and a second scope on the same failure would say it twice.
      if (documentId) void saveDocumentAs(documentId)
      return true
    }
    default:
      return false
  }
}
