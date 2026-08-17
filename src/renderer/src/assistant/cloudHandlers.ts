import { ASSET_TYPES, type AssetType } from '@shared/domain/asset'
import { refused } from '@shared/domain/assistant'
import type { CloudQuery, ExploreQuery } from '@shared/domain/cloudAsset'
import { SYNC_POLICIES } from '@shared/domain/sync'
import { withBridge, type ActionHandlers } from './actionHandler'
import { numberOf, oneOf, textOf, textsOf } from './actionInputs'

/**
 * The Scenario library on the other side of the wire.
 *
 * Every narrowing is asked affirmatively and omitted when absent, exactly as `assets.search` does:
 * an empty list is not "everything of no kind", it is a question the API does not answer.
 */

function typesOf(input: Record<string, unknown>): readonly AssetType[] {
  return textsOf(input, 'types').filter((type): type is AssetType =>
    ASSET_TYPES.some(known => known === type),
  )
}

function browseQuery(input: Record<string, unknown>): CloudQuery {
  const text = textOf(input, 'text')
  const cursor = textOf(input, 'cursor')
  const tags = textsOf(input, 'tags')
  const types = typesOf(input)
  const pageSize = numberOf(input, 'pageSize')

  return {
    ...(text === null ? {} : { text }),
    ...(tags.length === 0 ? {} : { tags }),
    ...(types.length === 0 ? {} : { types }),
    ...(cursor === null ? {} : { cursor }),
    ...(pageSize === null ? {} : { pageSize }),
  }
}

export const CLOUD_HANDLERS: ActionHandlers = {
  'cloud.browse': input => withBridge(bridge => bridge.cloud.browse(browseQuery(input))),

  'cloud.explore': input => {
    const type = oneOf(input, 'type', ASSET_TYPES)
    if (!type) return Promise.resolve(refused('badInput'))

    const cursor = textOf(input, 'cursor')
    const pageSize = numberOf(input, 'pageSize')
    const query: ExploreQuery = {
      type,
      ...(cursor === null ? {} : { cursor }),
      ...(pageSize === null ? {} : { pageSize }),
    }
    return withBridge(bridge => bridge.cloud.explore(query))
  },

  'cloud.similar': input =>
    withBridge(bridge => bridge.cloud.similar(textOf(input, 'assetId') ?? '')),

  'cloud.plan': input => {
    const policy = oneOf(input, 'policy', SYNC_POLICIES)
    return policy
      ? withBridge(bridge => bridge.cloud.plan(textsOf(input, 'assetIds'), policy))
      : Promise.resolve(refused('badInput'))
  },

  'cloud.pull': input => withBridge(bridge => bridge.cloud.pull(textsOf(input, 'remoteAssetIds'))),

  'cloud.push': input => withBridge(bridge => bridge.cloud.push(textsOf(input, 'assetIds'))),
}
