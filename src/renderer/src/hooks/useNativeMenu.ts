import { useEffect } from 'react'
import type { CommandId } from '@shared/domain/command'
import { saveDocument } from '@/app/document-io'
import { revealTool } from '@/helpers/reveal-panel'
import { availableToolIds } from '@/helpers/tool-registry'
import { getBridge } from '@/services/bridge'
import { publishCommand } from '@/services/command-bus'
import { reportFailure } from '@/services/diagnostics'
import { addNodeTo } from '@/hooks/useAddNode'
import { activeIdOfKind, useDocuments } from '@/stores/documents'
import { toolSurface, useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { useTools } from '@/stores/tools'

/** The global commands, which are the ones the native menu fires. The rest belong to a surface. */
function runCommand(command: CommandId): void {
  switch (command) {
    case 'layout.reset':
      useTools.getState().reset()
      return
    case 'project.new':
      void useProject.getState().createPicked()
      return
    case 'project.open':
      void useProject.getState().openPicked()
      return
    case 'document.save': {
      // The menu is application-wide and has no idea which tab is in front; the store does.
      const documentId = useDocuments.getState().activeId
      // The tab keeps its marker either way; the log is what says why it kept it.
      if (documentId) {
        void saveDocument(documentId).catch(error =>
          reportFailure('document.save', documentId, error),
        )
      }
      return
    }
    default:
      // Everything else belongs to a surface — the canvas, the scene, the timeline — and only
      // the document in front knows how to run it. Without this the whole Image menu fired into
      // nothing: eleven rows that looked live and did strictly nothing when clicked.
      publishCommand(command)
  }
}

/**
 * Tells the main process what the menu should offer. Published from here rather than from
 * `setActiveWorkspace`, because it depends on more than the section: choosing a model brings
 * the generator into existence, and the menu has to learn it at that moment.
 */
function publishMenuContext(): void {
  const workspace = useLayouts.getState().activeWorkspace
  // What the surface in front can open, not what the space behind it could: the home carries
  // the Explorer alone, and offering the other panels there would be menu entries that do
  // nothing visible.
  const tools = availableToolIds(toolSurface())
  void getBridge()?.window.setWorkspace(workspace, tools)
}

/**
 * Wires the native menu to the shell. Without this listener, "View ▸ Tool windows" would emit
 * into the void and the menu entries would silently do nothing.
 */
export function useNativeMenu(): void {
  // Subscribed once for the lifetime of the app: every listener below reads its store at call
  // time, so nothing here has to be torn down when a tab or a document changes.
  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

    // The persisted workspace is restored without going through `setActiveWorkspace`, so the
    // menu would sit on the default until the user switched spaces by hand.
    publishMenuContext()
    // The main process drops a rebuild that changes nothing, so publishing on every write of
    // these three stores costs a comparison rather than a menu.
    const stopPublishing = [useLayouts, useModels, useSettings].map(store =>
      store.subscribe(publishMenuContext),
    )

    // Through `revealTool`, which resolves the zone: a tool sits in different ones depending on
    // the workspace, and the menu is built once for the whole app.
    const stopTool = bridge.menu.onOpenTool(({ tool }) => revealTool(tool))

    const stopCommand = bridge.menu.onCommand(runCommand)
    // The same path the toolbar and the panels take: two ways of adding a node would drift.
    const stopSceneAdd = bridge.menu.onSceneAdd(({ kind }) => {
      // Of the right kind: the menu is app-wide, and a node written under an image document
      // would give it a scene and a history it has no editor for.
      const documentId = activeIdOfKind(useDocuments.getState(), 'scene')
      if (documentId) addNodeTo(documentId, kind)
    })

    return () => {
      stopTool()
      stopCommand()
      stopSceneAdd()
      for (const stop of stopPublishing) stop()
    }
  }, [])
}
