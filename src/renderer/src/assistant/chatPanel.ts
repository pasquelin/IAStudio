import { createMountedHost } from '@/helpers/hostRegistry'

/**
 * The assistant's own window, reachable from code that may not import its store.
 *
 * Registered rather than called directly to break an import loop: the conversation store imports
 * the executor so a turn can run a confirmed action, so nothing the executor reaches may import
 * that store back. `⌘K` is toggled rather than opened — it is what one presses to leave, too.
 */
export type ChatPanel = { toggle: () => void }

const host = createMountedHost<ChatPanel>()

/** Declares the overlay while it is mounted. Returns the way to take it back down. */
export const registerChatPanel = host.hold

/** The overlay, or `null` in a window that shows none — a settings window, a mirror. */
export const mountedChatPanel = host.get
