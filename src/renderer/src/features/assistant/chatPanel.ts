import { createMountedHost } from '@/helpers/hostRegistry'

/**
 * The conversation as it stands on screen — the right column's panel, or the empty centre.
 * Registered rather than imported: the conversation store imports the executor, so nothing the
 * executor reaches may import that store back.
 */
export type ChatPanel = { focus: () => void }

const host = createMountedHost<ChatPanel>()

/** Whether a host that has not mounted yet should take the caret as soon as it does. */
let awaited = false

/**
 * Declares the surface staging the conversation, and gives it the caret if one was asked for
 * before it mounted — revealing the panel and focusing its field is one gesture, two frames.
 */
export function registerChatPanel(panel: ChatPanel): () => void {
  const drop = host.hold(panel)
  if (awaited) {
    awaited = false
    panel.focus()
  }
  return drop
}

/** Puts the caret in the conversation, now or on the next host to mount. */
export function focusChat(): void {
  const staged = host.get()
  if (staged) staged.focus()
  else awaited = true
}

/** Whichever surface is staging it, or `null` when none is. */
export const mountedChatPanel = host.get
