import type { PanelSpec } from '@pasquelin/panels'
import i18next from 'i18next'
import { familyOf, type ToolId, type ToolSurface } from '@shared/domain/tool'
import { toolsOffered, toolStateOf, toolTitleKey, type ToolState } from '@/helpers/toolRegistry'
import { panelsStore } from '@/stores/panels'

/**
 * What the chassis is told about the panels a surface offers.
 *
 * ONE mapping, read by the shell that renders them and by anything driving the studio without a
 * window. Written twice, the two lists had to agree about a shape the compiler does not check —
 * and the headless one was already naming panels by their raw id where the window translates.
 */
export function panelSpecsOf(
  surface: ToolSurface,
  state: ToolState,
  title: (id: ToolId) => string,
): PanelSpec<ToolId>[] {
  return toolsOffered(surface, state).map(tool => ({
    id: tool.id,
    zone: tool.zone,
    slot: tool.slot,
    title: title(tool.id),
    opens: tool.opens,
    solo: tool.solo,
  }))
}

/**
 * Declares them into the store and brings the surface's view forward — what `<Shell>` does by
 * rendering `<Panel>`, for a run that has no window.
 *
 * Reads the stores RIGHT NOW, exactly as the shell reads them: call it once the answers a
 * `requires` asks about are set, and again whenever they change — `subscribeToToolState`.
 */
export function declarePanelsOf(surface: ToolSurface): void {
  const state = panelsStore.getState()

  // `i18next` rather than `useTranslation`: this has no React tree, and the instance is the one
  // the window uses — so a headless run says what a reader would see, pseudo-locale included.
  state.declare(panelSpecsOf(surface, toolStateOf(), id => i18next.t(toolTitleKey(id))))
  state.setView(familyOf(surface))
  state.settle()
}
