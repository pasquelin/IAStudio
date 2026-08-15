/**
 * Whether an effect cleanup is the component's real end, or the replay React runs when it merely
 * RELOCATED the node.
 *
 * In development React re-runs the effects of any child it had to move in the DOM — and it only
 * ever moves the child that is out of order. A cleanup written for a real teardown then fires on
 * a component that is still on screen, and undoes work nobody asked it to undo.
 *
 * The node itself is the only signal that tells the two apart, and it has to be HELD from the
 * effect body: React has already cleared its own refs by the time a cleanup runs. A node it moved
 * is back in the document before passive effects run; a node it deleted is not, and neither is one
 * whose ancestor left — `isConnected` answers for the whole chain up to the document.
 *
 * Measured over CDP in Electron, twice rather than deduced: 13 August 2026 on the rename field,
 * whose every rename opened and shut in one frame, and 15 August on the timeline's drag handle,
 * where a row dragged DOWN — the one node React relocates — dropped its own gesture at the first
 * rank it crossed.
 *
 * Its blind spot, written in clear: a subtree hidden by `<Activity mode="hidden">` keeps its
 * nodes IN the document and has its effects cut anyway, so this answers `false` for a teardown
 * that is real enough to matter. Nothing in the studio mounts one today; whoever brings the first
 * one owes every caller here a second look.
 */
export function isGoneForGood(node: Node | null | undefined): boolean {
  return !node?.isConnected
}
