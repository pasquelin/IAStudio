import { ASSET_TYPES, type AssetChanges, type AssetQuery } from '@shared/domain/asset'
import type { ActionOutcome, ActionRefusal } from '@shared/domain/assistant'
import { getBridge } from '@/services/bridge'
import type { ActionHandlers } from './actionHandler'
import { boolOf, numberOf, oneOf, textOf, textsOf } from './actionInputs'

/**
 * The library, queried and corrected from outside the window.
 *
 * The other half of `job.wait`: the ids a finished generation hands back are looked up here.
 */

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

async function search(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge')

  const text = textOf(input, 'text')
  const type = oneOf(input, 'type', ASSET_TYPES)
  const tags = textsOf(input, 'tags')
  const limit = numberOf(input, 'limit')
  const offset = numberOf(input, 'offset')

  const query: AssetQuery = {
    ...(text === null ? {} : { text }),
    ...(type ? { type } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    // Only ever asked affirmatively: "everything that was NOT generated" is a question the
    // catalogue does not answer, and `generated: false` would silently mean "no filter".
    ...(boolOf(input, 'generated') ? { generated: true } : {}),
    ...(limit === null ? {} : { limit }),
    ...(offset === null ? {} : { offset }),
  }

  return { ok: true, data: await bridge.assets.search(query) }
}

async function counts(): Promise<ActionOutcome> {
  const bridge = getBridge()
  return bridge ? { ok: true, data: await bridge.assets.counts() } : refused('noBridge')
}

/**
 * The rows behind a set of ids — NOT `assets.describe`, which is the captioning channel and
 * calls the API. What a finished job hands back is ids, and this is what reads them.
 */
async function read(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  const ids = textsOf(input, 'assetIds')
  if (!bridge) return refused('noBridge')
  if (ids.length === 0) return refused('badInput')

  return { ok: true, data: await bridge.assets.search({ ids, limit: ids.length }) }
}

async function update(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  const assetId = textOf(input, 'assetId')
  if (!bridge) return refused('noBridge')
  if (assetId === null) return refused('badInput')

  const name = textOf(input, 'name')
  const type = oneOf(input, 'type', ASSET_TYPES)
  const changes: AssetChanges = {
    ...(name === null ? {} : { name }),
    // Present-but-empty is a real instruction — tags are replaced wholesale — so the key is read
    // rather than the list: `[]` clears them, absent leaves them.
    ...(input.tags === undefined ? {} : { tags: textsOf(input, 'tags') }),
    ...(type ? { type } : {}),
  }

  if (Object.keys(changes).length === 0) return refused('badInput')
  return { ok: true, data: await bridge.assets.update(assetId, changes) }
}

async function remove(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  const assetIds = textsOf(input, 'assetIds')
  if (!bridge) return refused('noBridge')
  if (assetIds.length === 0) return refused('badInput')

  await bridge.assets.remove(assetIds, boolOf(input, 'alsoRemote'))
  return { ok: true }
}

export const ASSET_HANDLERS: ActionHandlers = {
  'assets.search': search,
  'assets.counts': counts,
  'asset.get': read,
  'asset.update': update,
  'assets.remove': remove,
}
