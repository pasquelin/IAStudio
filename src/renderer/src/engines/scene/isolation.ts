/**
 * What the viewport is hiding right now, which is never the same question as what the DOCUMENT
 * hides.
 *
 * `SceneNode.visible` is a property of the scene: it is saved, it is undone, it travels in the
 * glTF. Isolating to work on one object is none of those things — it is a way of looking, undone
 * by leaving isolation and gone when the tab closes. Writing one through the other is the defect
 * this module exists to make impossible: leaving isolation would set every node visible, wiping
 * out whatever the author had deliberately hidden.
 *
 * So the two are ANDed at the last moment, in the renderer, and nothing here ever writes a node.
 */

/** What the viewport hides on top of the document. Session state — see `sceneViews`. */
export type Isolation = {
  /**
   * The ids left visible, or `null` for "no isolation running". An EMPTY set is not the same
   * thing: it is an isolation of nothing, which is a black viewport and a legitimate state to
   * pass through while the selection changes.
   */
  only: ReadonlySet<string> | null
  /** Hidden one by one, which stacks with an isolation rather than replacing it. */
  hidden: ReadonlySet<string>
}

export const NOTHING_ISOLATED: Isolation = Object.freeze({ only: null, hidden: new Set<string>() })

/**
 * Whether the viewport draws this node, given what the document already says.
 *
 * The document wins: a node its author hid stays hidden inside an isolation, which is what makes
 * leaving one restore exactly the state that went in.
 */
export function drawsNode(isolation: Isolation, id: string, documentVisible: boolean): boolean {
  if (!documentVisible) return false
  if (isolation.hidden.has(id)) return false

  return isolation.only === null || isolation.only.has(id)
}

/**
 * Isolating a selection, subtree included: hiding the children of what one is working on leaves
 * an empty group on screen, and a model's own parts are what one isolates it to look at.
 *
 * The ANCESTORS come too, and they have to: three.js hides a subtree with its parent, so a mesh
 * kept visible under a group that is not would still be invisible.
 */
export function isolate(
  held: Isolation,
  ids: readonly string[],
  descendantsOf: (id: string) => readonly string[],
  ancestorsOf: (id: string) => readonly string[],
): Isolation {
  const only = new Set<string>()
  for (const id of ids) {
    only.add(id)
    for (const child of descendantsOf(id)) only.add(child)
    for (const parent of ancestorsOf(id)) only.add(parent)
  }

  // Isolating nothing is not isolating: an empty selection would black the viewport out with no
  // way back that looks like anything but a bug.
  // What was hidden by hand STAYS hidden — the two stack in both directions, or isolating would
  // be a way of undoing a hide nobody asked to undo.
  return only.size === 0 ? held : { only, hidden: held.hidden }
}

/** Hiding a selection from the viewport, on top of whatever is already hidden. */
export function hideIn(isolation: Isolation, ids: readonly string[]): Isolation {
  return { ...isolation, hidden: new Set([...isolation.hidden, ...ids]) }
}

/**
 * Whether anything at all is being hidden by the viewport, which is what a button reads.
 *
 * Showing everything again is `NOTHING_ISOLATED` itself, and deliberately has no function of its
 * own: « show all » restores what the VIEWPORT hid and nothing more — a node its author hid stays
 * hidden, and a helper here would be one more place to forget that.
 */
export function isolating(isolation: Isolation): boolean {
  return isolation.only !== null || isolation.hidden.size > 0
}
