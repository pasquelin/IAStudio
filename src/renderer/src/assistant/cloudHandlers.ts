import { CLOUD_ASSET_TYPES, type CloudAssetType } from '@shared/domain/asset'
import { refused } from '@shared/domain/assistant'
import { CLOUD_ORDERS, type CloudQuery, type ExploreQuery } from '@shared/domain/cloudAsset'
import { SYNC_POLICIES } from '@shared/domain/sync'
import { withBridge, type ActionHandlers } from './actionHandler'
import { numberOf, oneOf, textOf, textsOf } from './actionInputs'

/**
 * The Scenario library on the other side of the wire.
 *
 * Every narrowing is asked affirmatively and omitted when absent, exactly as `assets.searchProjectCatalogue` does:
 * an empty list is not "everything of no kind", it is a question the API does not answer.
 */

/** Only what the cloud sorts by: an agent asking for animations would be answered characters. */
function typesOf(input: Record<string, unknown>): readonly CloudAssetType[] {
  return textsOf(input, 'types').filter((type): type is CloudAssetType =>
    CLOUD_ASSET_TYPES.some(known => known === type),
  )
}

function browseQuery(input: Record<string, unknown>): CloudQuery {
  const text = textOf(input, 'text')
  const cursor = textOf(input, 'cursor')
  const tags = textsOf(input, 'tags')
  const types = typesOf(input)
  const pageSize = numberOf(input, 'pageSize')
  const order = oneOf(input, 'order', CLOUD_ORDERS)

  return {
    ...(text === null ? {} : { text }),
    ...(tags.length === 0 ? {} : { tags }),
    ...(types.length === 0 ? {} : { types }),
    ...(cursor === null ? {} : { cursor }),
    ...(pageSize === null ? {} : { pageSize }),
    ...(order === null ? {} : { order }),
  }
}

export const CLOUD_HANDLERS: ActionHandlers = {
  'cloud.browseAccountLibrary': input => {
    const query = browseQuery(input)
    // Refused rather than answered in another order, as a kind the studio does not have is: with
    // no words to rank by, relevance is whatever order the shard replies in.
    if (query.order === 'relevance' && query.text === undefined) {
      return Promise.resolve(
        refused(
          'badInput',
          `order "relevance" wants "text" to rank against — give the words, or ask for one of: ${CLOUD_ORDERS.filter(one => one !== 'relevance').join(', ')}`,
        ),
      )
    }

    return withBridge(bridge => bridge.cloud.browse(query))
  },

  'cloud.explorePublicFeed': input => {
    const type = oneOf(input, 'type', CLOUD_ASSET_TYPES)
    if (!type)
      return Promise.resolve(
        refused('badInput', `"type" wants one of: ${CLOUD_ASSET_TYPES.join(', ')}`),
      )

    const cursor = textOf(input, 'cursor')
    const pageSize = numberOf(input, 'pageSize')
    const query: ExploreQuery = {
      type,
      ...(cursor === null ? {} : { cursor }),
      ...(pageSize === null ? {} : { pageSize }),
    }
    return withBridge(bridge => bridge.cloud.explore(query))
  },

  'cloud.findSimilarPublished': input =>
    withBridge(bridge => bridge.cloud.similar(textOf(input, 'assetId') ?? '')),

  'cloud.previewSync': input => {
    const policy = oneOf(input, 'policy', SYNC_POLICIES)
    return policy
      ? withBridge(bridge => bridge.cloud.plan(textsOf(input, 'assetIds'), policy))
      : Promise.resolve(refused('badInput', `"policy" wants one of: ${SYNC_POLICIES.join(', ')}`))
  },

  'cloud.pull': input => withBridge(bridge => bridge.cloud.pull(textsOf(input, 'remoteAssetIds'))),

  'cloud.push': input => withBridge(bridge => bridge.cloud.push(textsOf(input, 'assetIds'))),
}
