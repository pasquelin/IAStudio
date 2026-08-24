import type { RoleProvider } from '@shared/domain/aiRole'
import type { LocalModel } from '@shared/domain/localModel'
import type { AssistantBrain } from './brainPort'

/**
 * Which brain answers a turn — the manager's decision, honoured rather than second-guessed.
 *
 * Nothing here branches on a cloud's NAME or a runtime's: the wiring owns tables keyed by id and
 * by loader, and this walks them.
 */

export type RoutedBrainDeps = {
  /** What serves the assistant right now, asked on every turn: it is a choice, and choices move. */
  providerOf: () => Promise<RoleProvider | null>
  /** The catalogue entry a stored id names, or nothing — a model can be dropped from a release. */
  modelOf: (modelId: string) => LocalModel | null
  /** A brain over one local model, or nothing when no runtime here can converse with it. */
  localBrain: (model: LocalModel) => AssistantBrain | null
  /** The brain of a cloud, BY ID. A cloud that cannot think answers nothing, never a branch. */
  cloudBrain: (providerId: string) => AssistantBrain | null
  /**
   * What the open project is about. Read HERE and not passed in by the window: this is the one
   * point every brain goes through, and a context a renderer names is one it could forge.
   */
  contextOf: () => Promise<string>
  /**
   * What the studio IS — the space, the document in front, the model armed. Asked of the window
   * on every turn, by the same route and for the same reason as the context above.
   *
   * Empty when no window answered. A turn still happens: the model is then as blind as it was
   * before any of this, which is worse than knowing and better than waiting.
   */
  stateOf: () => Promise<string>
}

/** The brain and, when there is none, the reason — which is the only thing left to say. */
function brainFor(
  deps: RoutedBrainDeps,
  provider: RoleProvider | null,
): [AssistantBrain | null, string] {
  if (provider === null) return [null, 'no provider available']
  if (provider.kind === 'cloud') {
    return [deps.cloudBrain(provider.providerId), `${provider.providerId} cannot think`]
  }

  const model = deps.modelOf(provider.modelId)
  if (model === null) return [null, `${provider.modelId} is not in the catalogue`]

  return [deps.localBrain(model), `nothing here converses with ${model.id}`]
}

/**
 * Raised rather than answered with an empty sentence: the window marks a rejected turn LOST and
 * says so, where an empty answer reads as a model that had nothing to add.
 */
export function createRoutedBrain(deps: RoutedBrainDeps): AssistantBrain {
  return {
    think: async (request, signal) => {
      // The three together: WHICH brain answers probes the runtimes, and neither the project nor
      // the studio's state depends on the answer. Serially, the person waited for their sum.
      const [provider, context, state] = await Promise.all([
        deps.providerOf(),
        deps.contextOf(),
        deps.stateOf(),
      ])

      const [brain, why] = brainFor(deps, provider)
      if (brain === null) throw new Error(`nothing serves the assistant: ${why}`)

      return await brain.think({ ...request, context, state }, signal)
    },
  }
}
