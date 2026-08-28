import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { CommandId } from '@shared/domain/command'
import { isUiElementType } from '@shared/domain/ui'
import { newUiElement } from '@shared/domain/uiDocument'
import { UI_RESOLUTIONS, isUiResolutionId, uiResolutionOf } from '@shared/domain/uiResolution'
import { elementById, parentOf } from '@game/ui/uiTree'
import { Toolbar } from '@/design/Toolbar/Toolbar'
import { composed } from '@/engines/core/history'
import {
  addUiElement,
  duplicateUiElements,
  groupUiElements,
  removeUiElements,
  setUiFlag,
} from '@/engines/gui/guiCommands'
import { newId } from '@/helpers/ids'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useDocumentIsInFront } from '@/stores/documents'
import { guiOf, isGuiDirty, useGuis } from '@/stores/gui'
import { GuiStage } from './GuiStage/GuiStage'
import { GUI_ADD_TOOL, GUI_RESOLUTION_TOOL, GUI_TOOLS } from './guiTools'
import { fitGuiToPanel, guiToActualSize, setGuiResolution, zoomGuiIn, zoomGuiOut } from './guiView'

/**
 * A game interface, open for editing.
 *
 * The scope is `gui` and not the space's: the 3D space opens two kinds now, so ⌘Z here must not
 * reach the scene's history — `scopeOfDocument` says which, and this is the other half of it.
 *
 * Every edit goes through a `Command<GuiState>`, which is what makes the window, a shortcut and
 * — from the MCP lot on — the assistant one door rather than three.
 */
export function GuiDocument({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const active = useDocumentIsInFront(documentId)
  const selectedIds = useGuis(state => guiOf(state, documentId).selectedIds)
  const design = useGuis(state => guiOf(state, documentId).document.design)

  useDocumentTitle(
    documentId,
    useGuis(state => isGuiDirty(state, documentId)),
  )

  useRestoredDocument(documentId)

  const onCommand = useCallback(
    (command: CommandId) => {
      const store = useGuis.getState()
      if (command === 'gui.undo') return store.undo(documentId)
      if (command === 'gui.redo') return store.redo(documentId)
    },
    [documentId],
  )

  useShortcuts({ scope: 'gui', enabled: active, documentId, onCommand })

  /** Where an added element hangs: inside what is selected when it can hold one, beside it if not. */
  const addTo = (): string => {
    const state = guiOf(useGuis.getState(), documentId)
    const picked = selectedIds.at(-1)
    const element = picked ? elementById(state.document.root, picked) : null
    if (!element) return state.document.root.id

    return 'children' in element
      ? element.id
      : (parentOf(state.document.root, element.id)?.id ?? state.document.root.id)
  }

  const onTool = (id: string): void => {
    const store = useGuis.getState()
    if (id === 'gui.duplicate')
      return store.runCommand(documentId, duplicateUiElements(selectedIds, newId))
    if (id === 'gui.group') return store.runCommand(documentId, groupUiElements(selectedIds, newId))
    if (id === 'gui.delete') return store.runCommand(documentId, removeUiElements(selectedIds))
    if (id === 'gui.lock') return lockSelection()
    if (id === 'gui.zoomIn') return zoomGuiIn(documentId)
    if (id === 'gui.zoomOut') return zoomGuiOut(documentId)
    if (id === 'gui.fit') return fitGuiToPanel(documentId)
    if (id === 'gui.actual') return guiToActualSize(documentId)
  }

  /**
   * What the FIRST of the selection is not — a mixed batch has to settle on one answer — and ONE
   * entry in the history for all of them, whatever the count.
   */
  const lockSelection = (): void => {
    const state = guiOf(useGuis.getState(), documentId)
    const first = selectedIds[0]
    if (first === undefined) return

    const locked = elementById(state.document.root, first)?.locked === true
    useGuis.getState().runCommand(
      documentId,
      composed(
        `ui.locked:${selectedIds.join(',')}`,
        selectedIds.map(id => setUiFlag(id, 'locked', !locked)),
      ),
    )
  }

  const onMode = (toolId: string, modeId: string): void => {
    if (toolId === GUI_ADD_TOOL && isUiElementType(modeId)) {
      useGuis.getState().runCommand(documentId, addUiElement(addTo(), newUiElement(modeId, newId)))
      return
    }
    if (toolId === GUI_RESOLUTION_TOOL && isUiResolutionId(modeId)) {
      const size = UI_RESOLUTIONS[modeId]
      // `free` measures nothing: it is what a document already at an unnamed size IS, not a
      // size to go to, so choosing it leaves the canvas where it stands.
      if (size) setGuiResolution(documentId, size)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      <Toolbar
        // The canvas the document is composed for is a CHOICE among the presets, so the bar
        // shows which one is standing rather than opening on whatever comes first.
        tools={GUI_TOOLS.map(tool =>
          tool.id === GUI_RESOLUTION_TOOL ? { ...tool, activeMode: uiResolutionOf(design) } : tool,
        )}
        label={t('gui.tools')}
        onTool={onTool}
        onMode={onMode}
      />
      <GuiStage documentId={documentId} />
    </div>
  )
}
