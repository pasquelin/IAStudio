import { commandDescriptor, type CommandId } from '@shared/domain/command'
import type { StudioBridge } from '@shared/ipc'
import { saveDocument, saveDocumentAs } from '@/app/documentIo'
import { importOtioz } from '@/app/otioImport'
import { mountedChatPanel } from '@/assistant/chatPanel'
import { applyWorkspaceMove } from '@/helpers/applyWorkspaceMove'
import { getBridge } from '@/services/bridge'
import { commandScopeIsArmed, publishCommand } from '@/services/commandBus'
import { reportFailure } from '@/services/diagnostics'
import { useDictation } from '@/stores/dictation'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { useTools } from '@/stores/tools'

/**
 * Where a command goes, and whether anything took it — one router for the three doors that fire
 * one: the native menu, the assistant, and an MCP client on the other side of the machine.
 *
 * `nothingToDo` is told apart from `noSurface` because a caller reads them differently: a space
 * already at the end of the bar is not a studio showing the wrong thing.
 */
export type CommandRouting = 'ran' | 'noSurface' | 'nothingToDo' | 'noBridge'

/** Runs it through the bridge, or says the window has none — a mirror, a test with no preload. */
function through(run: (bridge: StudioBridge) => void): CommandRouting {
  const bridge = getBridge()
  if (!bridge) return 'noBridge'

  run(bridge)
  return 'ran'
}

/** The space the bar would move: the one in front, since a command names no other. */
function moveActiveSpace(move: 'left' | 'right'): CommandRouting {
  return applyWorkspaceMove(useLayouts.getState().activeWorkspace, move) ? 'ran' : 'nothingToDo'
}

/**
 * Push-to-talk with neither half, so it starts and stops rather than holding.
 *
 * NOT `setHeld`: outside push-to-talk that one acts on the press alone, so a release asked for
 * from here did nothing at all while the caller was told it ran.
 */
function toggleDictation(): CommandRouting {
  const dictation = useDictation.getState()
  void (dictation.state === 'listening' ? dictation.stop() : dictation.start())
  return 'ran'
}

/**
 * The commands the application performs itself, having no surface that listens for them.
 *
 * `null` means "not one of mine", which is the answer for everything a document owns.
 */
function runHere(command: CommandId): CommandRouting | null {
  switch (command) {
    case 'layout.reset':
      useTools.getState().reset()
      return 'ran'
    case 'project.new':
      void useProject.getState().createPicked()
      return 'ran'
    case 'project.open':
      void useProject.getState().openPicked()
      return 'ran'
    // No document in front to belong to: an import is what makes one. Its own failures are
    // journaled under `sequence.import`, so nothing is caught here.
    case 'montage.import':
      void importOtioz()
      return 'ran'
    // The section the window opens on when nothing named one — the same one its own row opens.
    case 'app.settings':
      return through(bridge => void bridge.settings.open('general'))
    case 'window.fullScreen':
      return through(bridge => void bridge.window.toggleFullScreen())
    case 'app.assistant': {
      const panel = mountedChatPanel()
      if (!panel) return 'noSurface'

      panel.toggle()
      return 'ran'
    }
    case 'app.dictate':
      return toggleDictation()
    case 'spaces.moveLeft':
      return moveActiveSpace('left')
    case 'spaces.moveRight':
      return moveActiveSpace('right')
    // These two answer `noSurface` with no document in front: reporting a save that had nothing
    // to save is the very thing this module exists to stop.
    case 'document.save': {
      // The menu is application-wide and has no idea which tab is in front; the store does.
      const documentId = useDocuments.getState().activeId
      if (!documentId) return 'noSurface'

      // The tab keeps its marker either way; the log is what says why it kept it.
      void saveDocument(documentId).catch(error =>
        reportFailure('document.save', documentId, error),
      )
      return 'ran'
    }
    case 'document.saveAs': {
      const documentId = useDocuments.getState().activeId
      if (!documentId) return 'noSurface'

      // No `catch` here, unlike Save: `saveDocumentAs` journals its own failures under
      // `assets.copy` and answers false — a second scope on the same failure would say it twice.
      void saveDocumentAs(documentId)
      return 'ran'
    }
    default:
      return null
  }
}

/**
 * Fires one command wherever it belongs, and says whether it landed — which an MCP client needs
 * and a menu row does not: `publishCommand` is memoryless, so a command sent while nothing of
 * that scope is mounted vanishes in silence.
 */
export function routeCommand(command: CommandId): CommandRouting {
  const here = runHere(command)
  if (here) return here

  // The lookup takes a string, so the type cannot know a `CommandId` is always declared. Anything
  // left here belongs to a surface: `runHere` answers for every `global` and `spaces` command.
  const descriptor = commandDescriptor(command)
  if (!descriptor || !commandScopeIsArmed(descriptor.scope)) return 'noSurface'

  publishCommand(command)
  return 'ran'
}
