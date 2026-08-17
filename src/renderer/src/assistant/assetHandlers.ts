import { ASSET_TYPES, type AssetChanges, type AssetQuery } from '@shared/domain/asset'
import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { withBridge, type ActionHandlers } from './actionHandler'
import { boolOf, numberOf, oneOf, textOf, textsOf } from './actionInputs'

/**
 * The library, queried and corrected from outside the window — the other half of `job.wait`:
 * the ids a finished generation hands back are looked up here.
 */

function queryOf(input: Record<string, unknown>): AssetQuery {
  const text = textOf(input, 'text')
  const type = oneOf(input, 'type', ASSET_TYPES)
  const tags = textsOf(input, 'tags')
  const limit = numberOf(input, 'limit')
  const offset = numberOf(input, 'offset')

  return {
    ...(text === null ? {} : { text }),
    ...(type ? { type } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    // Only ever asked affirmatively: "everything that was NOT generated" is a question the
    // catalogue does not answer, and `generated: false` would silently mean "no filter".
    ...(boolOf(input, 'generated') ? { generated: true } : {}),
    ...(limit === null ? {} : { limit }),
    ...(offset === null ? {} : { offset }),
  }
}

function update(input: Record<string, unknown>): Promise<ActionOutcome> {
  const name = textOf(input, 'name')
  const type = oneOf(input, 'type', ASSET_TYPES)
  const changes: AssetChanges = {
    ...(name === null ? {} : { name }),
    // Present-but-empty is a real instruction — tags are replaced wholesale — so the key is read
    // rather than the list: `[]` clears them, absent leaves them.
    ...(input.tags === undefined ? {} : { tags: textsOf(input, 'tags') }),
    ...(type ? { type } : {}),
  }

  if (Object.keys(changes).length === 0) return Promise.resolve(refused('badInput'))
  return withBridge(bridge => bridge.assets.update(textOf(input, 'assetId') ?? '', changes))
}

export const ASSET_HANDLERS: ActionHandlers = {
  'assets.search': input => withBridge(bridge => bridge.assets.search(queryOf(input))),
  'assets.counts': () => withBridge(bridge => bridge.assets.counts()),
  'asset.update': update,

  /**
   * Through the catalogue, NOT through `assets.describe` — that one is the captioning channel and
   * calls the API. Reading a generation's output must cost nothing.
   */
  'asset.get': input => {
    const ids = textsOf(input, 'assetIds')
    return withBridge(bridge => bridge.assets.search({ ids, limit: ids.length }))
  },

  'assets.remove': input =>
    withBridge(bridge =>
      bridge.assets.remove(textsOf(input, 'assetIds'), boolOf(input, 'alsoRemote')),
    ),
}
