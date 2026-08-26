/**
 * The isolation a selection of a SCENE asks for — the one place that reads `SceneNode[]` to
 * answer what `isolation.ts` states as a rule.
 *
 * Apart from that module because `isolation.ts` knows nothing of scenes and stays testable on
 * plain sets; here is where a tree turns into one.
 */
import { isolate, isolating, NOTHING_ISOLATED, type Isolation } from './isolation'
import { subtreesOf, type SceneNode } from './sceneState'

/**
 * Isolating a selection, subtree and ancestry included.
 *
 * The ancestors are not a nicety: three.js hides a whole subtree with its parent, so a mesh kept
 * visible under a group that is not would still be invisible.
 */
export function isolationFor(
  nodes: readonly SceneNode[],
  ids: readonly string[],
  held: Isolation = NOTHING_ISOLATED,
): Isolation {
  const parentOf = new Map(nodes.map(node => [node.id, node.parentId]))
  // ONE pass for the whole selection: asked per id, `subtreesOf` rebuilt the scene's index that
  // many times. `isolate` melts them into one set anyway — which root a descendant came from was
  // never read.
  const under = new Set(subtreesOf(nodes, ids).map(node => node.id))

  return isolate(
    held,
    ids,
    () => under,
    id => {
      const found: string[] = []
      for (let at = parentOf.get(id); at; at = parentOf.get(at)) found.push(at)
      return found
    },
  )
}

/**
 * What the isolate command and the isolate button both do — in and back out.
 *
 * Read through `isolating` rather than `only`: a viewport hiding things one by one is hiding
 * things, and the key that gets somebody out of an isolation is the key they expect to get them
 * out of a hide as well.
 */
export function toggledIsolation(
  held: Isolation,
  nodes: readonly SceneNode[],
  ids: readonly string[],
): Isolation {
  return isolating(held) ? NOTHING_ISOLATED : isolationFor(nodes, ids)
}
