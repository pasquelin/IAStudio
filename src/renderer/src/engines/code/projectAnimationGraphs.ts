// SPDX-License-Identifier: MIT
import type { AnimationGraphModule } from '@shared/domain/animationGraph'
import { getBridge } from '@/services/bridge'

async function readGraph(path: string): Promise<AnimationGraphModule | null> {
  try {
    const graph = await getBridge()?.animationGraphs.read(path)
    return graph ? { path, graph } : null
  } catch {
    // A file that will not parse is one the project cannot play: it is left out rather than
    // stopping every other graph from loading. The reader said why, in its own message.
    return null
  }
}

export async function projectAnimationGraphs(): Promise<AnimationGraphModule[]> {
  try {
    const paths = await getBridge()?.animationGraphs.list()
    if (!paths) return []
    const graphs = await Promise.all(paths.map(readGraph))
    return graphs.filter((graph): graph is AnimationGraphModule => graph !== null)
  } catch {
    return []
  }
}
