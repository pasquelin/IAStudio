import type { StudioBridge } from '@shared/ipc'

/**
 * Single accessor for the preload bridge. It is absent in tests and in a plain browser, and
 * repeating `typeof studio === 'undefined'` in every hook would spread that knowledge — and
 * would contradict the global declaration, which types `studio` as always present.
 */
export function getBridge(): StudioBridge | null {
  return typeof studio === 'undefined' ? null : studio
}

/** Nothing was subscribed to, so unsubscribing is a no-op. One identity, shared by every store. */
const NOTHING_TO_STOP = (): void => {}

/**
 * A store's `connect`, for the seven that need the bridge to subscribe to anything. Without one —
 * a test, a plain browser — there is nothing to listen to and nothing to unsubscribe from, which
 * is the answer, not a failure.
 */
export function connectThroughBridge(
  join: (bridge: StudioBridge) => Promise<() => void>,
): () => Promise<() => void> {
  return async () => {
    const bridge = getBridge()
    return bridge ? join(bridge) : NOTHING_TO_STOP
  }
}

/**
 * The version half of the bridge, answered as something that may not be there.
 *
 * The global types it as always present, and in a shipped application it is: preload and renderer
 * come out of one build. In DEVELOPMENT they do not have to — a window whose preload predates a
 * branch has every other half and not this one, and `getBridge()?.git.read()` then throws where
 * every caller was written expecting a bridge that answers nothing. Measured on 17 August: the
 * panel stayed on its opening state and said no project was open, over an open project, while
 * the console filled with `Cannot read properties of undefined`.
 */
export function gitBridge(): StudioBridge['git'] | undefined {
  return getBridge()?.git
}

/**
 * The memory half of the bridge, for the reason `gitBridge` exists — and the reason is the same
 * one: `getBridge()?.memory.remember(…)` guards the BRIDGE and not the half, so a window whose
 * preload predates this branch throws `Cannot read properties of undefined` instead of answering
 * nothing. `rememberOutcome` is called on a `void`, so that throw is an unhandled rejection.
 */
export function memoryBridge(): StudioBridge['memory'] | undefined {
  return getBridge()?.memory
}
