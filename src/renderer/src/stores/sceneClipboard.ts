import { create } from 'zustand'
import type { SceneNode } from '@/engines/scene/sceneState'

type ClipboardState = {
  /** What was last copied, as whole subtrees. Empty until something is. */
  nodes: readonly SceneNode[]
  copy: (nodes: readonly SceneNode[]) => void
}

/**
 * A clipboard of the studio's own, not the system's.
 *
 * A scene node has no useful text form, so putting one on the system clipboard would either
 * write nonsense into whatever is pasted next or need a private format nothing else reads. And
 * the system clipboard is shared with every other application: copying a node would silently
 * throw away what someone had in there.
 *
 * A store rather than a module-level value, so a toolbar can grey Paste out when it holds
 * nothing — the state is what the interface reads, not something it has to ask for.
 */
export const useSceneClipboard = create<ClipboardState>()(set => ({
  nodes: [],
  copy: nodes => set({ nodes }),
}))
