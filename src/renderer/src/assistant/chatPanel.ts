import { createMountedHost } from '@/helpers/hostRegistry'

/**
 * The assistant's own window, registered rather than imported: the conversation store imports the
 * executor, so nothing the executor reaches may import that store back.
 */
export type ChatPanel = { toggle: () => void }

const host = createMountedHost<ChatPanel>()

/** Declares the overlay while it is mounted. Returns the way to take it back down. */
export const registerChatPanel = host.hold

/** The overlay, or `null` in a window that shows none — a settings window, a mirror. */
export const mountedChatPanel = host.get
