import type { CommandId } from '@shared/domain/command'
import { saveDocument, saveDocumentAs } from '@/app/documentIo'
import { importOtioz } from '@/app/otioImport'
import { reportFailure } from '@/services/diagnostics'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { useTools } from '@/stores/tools'

/**
 * The commands that belong to the application rather than to a document, and how each is run.
 *
 * Here rather than in the menu hook because the menu is not the only caller: the assistant runs
 * the same commands, and a second `switch` beside this one would be two ways of saving a
 * document that drift. `publishCommand` cannot serve them — it is memoryless and filtered by
 * scope on the subscriber's side, and nothing subscribes to these.
 *
 * Answers whether it ran the command, `false` being anything this does not own: a command that
 * belongs to a surface, the ones the main process performs itself, and `app.assistant` — see
 * `useNativeMenu`, which keeps that one.
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
    // No document in front to belong to: an import is what makes one. Its own failures are
    // journaled under `sequence.import`, so nothing is caught here.
    case 'montage.import':
      void importOtioz()
      return true
    // These two answer `false` with no document in front, where the others answer `true`: the
    // menu greys its row out and cannot get here, but the assistant can — and reporting a save
    // that had nothing to save is the very thing this module exists to stop.
    case 'document.save': {
      // The menu is application-wide and has no idea which tab is in front; the store does.
      const documentId = useDocuments.getState().activeId
      if (!documentId) return false

      // The tab keeps its marker either way; the log is what says why it kept it.
      void saveDocument(documentId).catch(error =>
        reportFailure('document.save', documentId, error),
      )
      return true
    }
    case 'document.saveAs': {
      const documentId = useDocuments.getState().activeId
      if (!documentId) return false

      // No `catch` here, unlike Save: `saveDocumentAs` journals its own failures under
      // `assets.copy` and answers false — the shelf the copy would have landed in is where a
      // reader looks for it, and a second scope on the same failure would say it twice.
      void saveDocumentAs(documentId)
      return true
    }
    default:
      return false
  }
}
