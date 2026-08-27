import { refused } from '@shared/domain/assistant'
import { gameTemplate } from '@shared/domain/gameTemplate'
import { refFromString } from '@shared/domain/ref'
import { addNodes } from '@/engines/scene/commands'
import { layOutTemplate } from '@/engines/scene/templateCommands'
import { instancedNodes } from '@/engines/scene/prefab'
import { useScenes } from '@/stores/scenes'
import type { ActionHandlers } from './actionHandler'
import { numberOf, textOf } from './actionInputs'
import { mounted } from './sceneHandlers'
import { withBridge } from './actionHandler'

/**
 * What puts a whole game together in one gesture — a template, or a prefab of the project.
 *
 * 🛑 Both are ASSEMBLIES: they lay down nodes carrying components the runtime already drives.
 * Neither adds a way of playing, which is what keeps a preset from becoming a second runtime.
 */
export const ASSEMBLY_HANDLERS: ActionHandlers = {
  'game.template': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const held = gameTemplate(textOf(input, 'template') ?? '')
    if (!held) return refused('badInput', `no template "${textOf(input, 'template') ?? ''}"`)

    useScenes.getState().runCommand(open.documentId, layOutTemplate(held))
    return { ok: true, data: { pieces: held.pieces.length, camera: held.play.camera } }
  },

  'prefab.instantiate': async input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const named = textOf(input, 'prefab') ?? ''
    const ref = refFromString(named)
    const documentId = ref?.kind === 'prefab' ? ref.id : named
    const read = await withBridge(bridge => bridge.documents.read(documentId, 'scene'))
    if (!read.ok) return read
    if (read.data === null) return refused('notFound', `no prefab "${named}"`)

    const at = {
      x: numberOf(input, 'x') ?? 0,
      y: numberOf(input, 'y') ?? 0,
      z: numberOf(input, 'z') ?? 0,
    }
    const nodes = instancedNodes(read.data, at)
    if (nodes.length === 0) return refused('badInput', `"${named}" holds nothing to instance`)

    useScenes.getState().runCommand(open.documentId, addNodes(nodes))
    return { ok: true, data: { nodes: nodes.length } }
  },
}
