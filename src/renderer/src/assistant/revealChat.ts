import { revealTool } from '@/helpers/revealPanel'
import { focusChat, mountedChatPanel } from './chatPanel'
import { mountedConfirmer } from './confirm'

/**
 * Brings the conversation under the eye, and the caret into it. A host already on screen is
 * focused rather than replaced: with no document open the centre holds the thread, and the
 * column offers no panel at all.
 *
 * 🛑 The confirmer is the marker of a window that HAS a shell: a settings window and a mirror
 * hold neither host, and writing the docks store there answered "done" for nothing happening.
 */
export function revealChat(): boolean {
  const staged = mountedChatPanel()
  if (!staged && (mountedConfirmer() === null || !revealTool('assistant'))) return false

  focusChat()
  return true
}
