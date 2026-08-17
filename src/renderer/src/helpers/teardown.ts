/**
 * Tells a real teardown from the effect replay React runs when it merely RELOCATED the node: a
 * moved node is back in the document before passive effects run, a deleted one is not. Hold the
 * node from the effect BODY — React has cleared its own refs by cleanup time. Blind spot, and it
 * has no caller today: `<Activity mode="hidden">` keeps its nodes in the document either way.
 */
export function isGoneForGood(node: Node | null | undefined): boolean {
  return !node?.isConnected
}
