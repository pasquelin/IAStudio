import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { isSettingsSection } from '@shared/domain/settings'
import { TOOL_IDS, type ToolId } from '@shared/domain/tool'
import { closeTool, revealTool, toolIsShown } from '@/helpers/revealPanel'
import { availableToolIds } from '@/helpers/toolRegistry'
import { useDictation } from '@/stores/dictation'
import { toolSurface } from '@/stores/layouts'
import { withBridge, type ActionHandlers } from './actionHandler'
import { boolOf, oneOf, textOf } from './actionInputs'

/**
 * The window, the account and the small lists the studio keeps outside every project.
 *
 * Every one of these is a pass-through to a channel of `shared/ipc.ts`, and that is the whole of
 * what they are: the work already lives in the main process, it simply had no door.
 */

/** Opens or closes the panel named, which both answer `false` for one this surface does not serve. */
function showPanel(input: Record<string, unknown>, run: (panel: ToolId) => boolean): ActionOutcome {
  const panel = oneOf(input, 'panel', TOOL_IDS)
  if (!panel) return refused('badInput')

  return run(panel) ? { ok: true } : refused('wrongSurface')
}

export const SHELL_HANDLERS: ActionHandlers = {
  'auth.state': () => withBridge(bridge => bridge.settings.authState()),
  'updates.state': () => withBridge(bridge => bridge.updates.state()),
  'media.capabilities': () => withBridge(bridge => bridge.media.capabilities()),
  'fonts.list': () => withBridge(bridge => bridge.fonts.list()),
  'favorites.list': () => withBridge(bridge => bridge.favorites.list()),
  'mirror.open': () => withBridge(bridge => bridge.mirror.open()),
  'window.fullScreen': () => withBridge(bridge => bridge.window.toggleFullScreen()),

  /**
   * The window AND the language it draws in, in one answer: the language is resolved by the main
   * process — the setting may say `system`, and only that side sees what the machine prefers.
   */
  'window.state': () =>
    withBridge(async bridge => ({
      ...(await bridge.window.state()),
      language: await bridge.window.language(),
    })),

  'settings.open': input => {
    const section = textOf(input, 'section')
    return isSettingsSection(section)
      ? withBridge(bridge => bridge.settings.open(section))
      : Promise.resolve(refused('badInput'))
  },

  /**
   * Answers the row itself rather than `ok` alone: `adopt` gives back `null` for a file the
   * studio cannot read, and a client told only "done" would go looking for an asset that was
   * never created.
   */
  'media.adopt': async input => {
    const outcome = await withBridge(bridge => bridge.media.adopt(textOf(input, 'path') ?? ''))
    return outcome.ok && outcome.data === null ? refused('badInput') : outcome
  },

  'favorite.pin': input =>
    withBridge(bridge => bridge.favorites.pin(textOf(input, 'assetId') ?? '')),

  'favorite.unpin': input =>
    withBridge(bridge => bridge.favorites.unpin(textOf(input, 'favoriteId') ?? '')),

  'fileInfo.open': input => withBridge(bridge => bridge.fileInfo.open(textOf(input, 'path') ?? '')),

  'updates.install': () => withBridge(bridge => bridge.updates.install()),

  // Only what this surface serves: a panel it does not carry cannot be opened there, so offering
  // it would be offering a refusal.
  'panels.list': () => {
    const surface = toolSurface()
    const panels = availableToolIds(surface).map(id => ({ id, open: toolIsShown(id, surface) }))
    return { ok: true, data: panels }
  },

  'panel.open': input => showPanel(input, revealTool),
  'panel.close': input => showPanel(input, closeTool),

  'dictation.state': () => withBridge(bridge => bridge.dictation.state()),

  'dictation.start': async () => {
    await useDictation.getState().start()
    // The store reports its own failure rather than throwing: a microphone the machine refused
    // is a state, and answering `ok` on it would have a client wait for words never heard.
    const { state, failure } = useDictation.getState()
    return state === 'listening' ? { ok: true } : refused(failure ? 'failed' : 'notAllowed')
  },

  'dictation.stop': async input => {
    const dictation = useDictation.getState()
    await (boolOf(input, 'discard') ? dictation.cancel() : dictation.stop())
    return { ok: true }
  },
}
