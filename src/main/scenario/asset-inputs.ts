import type { Asset } from '@shared/domain/asset'
import { ASSET_ID_PREFIX, isForeignTwin, movedSince } from '@shared/domain/asset'

export type AssetInputDeps = {
  /** The catalogue row an id names, or `null` when no local asset answers to it. */
  find: (assetId: string) => Promise<Asset | null>
  /** Sends a local asset to the account library and records the twin — `CloudBackend.push`. */
  push: (assetId: string) => Promise<Asset>
  /** The project the key in force opens onto, or `null` while nothing has said. */
  activeOwnerId: () => string | null
}

/**
 * Whether the twin recorded on an asset is one the API would answer for right now.
 *
 * Two ways it would not, and neither says its own name: it belongs to another project, because
 * a key carries its own and switching accounts changes what the id even refers to — the reader
 * is the badge's own, so the tile and this can never disagree; or the file has been edited since
 * it went up, in which case sending the old twin runs the generation on a picture the user no
 * longer sees. The first answers 404, the second answers a plausible wrong thing.
 */
function standingTwinOf(asset: Asset, activeOwnerId: string | null): string | undefined {
  if (asset.remoteAssetId === undefined || isForeignTwin(asset, activeOwnerId)) return undefined

  return movedSince(asset.localChangedAt, asset.remoteSyncedAt) ? undefined : asset.remoteAssetId
}

/**
 * Rewrites the local asset ids a generation body carries into the ids Scenario knows them by.
 *
 * The two vocabularies look alike and are not: the collector stamps a row with a fresh
 * `asset_<uuid>` and files the API's own id under `remoteAssetId`, so what a drop target hands
 * to a form is an identifier the API has never heard of. Left alone, a generation with a
 * reference picture is submitted, paid for, and answers as though no reference had been given.
 *
 * Done here rather than in whatever asks for the run, because both endpoints take a body of the
 * model's own shape and neither says which of its keys is a picture — and because the graph is
 * about to make chaining two models the ordinary case.
 *
 * What deliberately does NOT come through here: a cost estimate, which is asked on every
 * keystroke and must not send a file up for a figure nobody is waiting on. The estimate of a
 * form holding a picture is therefore made without it, and `referenceImages` is priced
 * (`cost_impact: true`) — so it can read low. Prompt assistance has the same gap for another
 * reason: it is not a job, and it never reaches this. Both are written down in `docs/todo.md`.
 */
export type AssetInputResolver = (body: Record<string, unknown>) => Promise<Record<string, unknown>>

export function createAssetInputResolver({
  find,
  push,
  activeOwnerId,
}: AssetInputDeps): AssetInputResolver {
  /**
   * The transfers under way, shared by every body being resolved at once.
   *
   * Held here and not per call, because the job loop runs two at a time by default: relaunching
   * a generation while the first still holds the same never-sent picture had both look, both
   * find no twin, and both send the file — paid for twice, two twins in the library, and the
   * catalogue keeping only whichever wrote last. Keyed by the account too, since an id means a
   * different thing under another key. Dropped on settling, so nothing accumulates.
   */
  const sending = new Map<string, Promise<string>>()

  const sendOnce = (localId: string, owner: string | null): Promise<string> => {
    const key = `${owner ?? ''}:${localId}`
    const started = sending.get(key)
    if (started) return started

    // Let the error through rather than submit the local id: a run the API cannot resolve is
    // paid for and comes back wrong, with nothing anywhere saying why. Same reason a push that
    // came back without a twin is refused instead of falling back.
    const pending = push(localId).then(pushed => {
      if (!pushed.remoteAssetId) throw new Error(`${localId} was sent without becoming a twin`)
      return pushed.remoteAssetId
    })

    sending.set(key, pending)
    return pending.finally(() => sending.delete(key))
  }

  return async body => {
    // Read once for the whole body: a switch mid-walk would judge two pictures of one run
    // against two different projects.
    const owner = activeOwnerId()

    const remoteIdOf = async (localId: string): Promise<string> => {
      const asset = await find(localId)
      if (!asset) return localId

      const standing = standingTwinOf(asset, owner)
      if (standing) return standing

      return await sendOnce(localId, owner)
    }

    const seen = new WeakSet<object>()

    /**
     * One value at a time, and the two reasons are worth keeping together: an upload is an
     * unbounded file transfer that nothing in the studio paces — a picture list caps at ten —
     * and being sequential is what makes the twin of an id recorded before the next lookup of
     * it. Running siblings at once would need the in-flight map back, or the same file goes up
     * twice and is billed twice.
     */
    const rewrite = async (value: unknown): Promise<unknown> => {
      if (typeof value === 'string') {
        return value.startsWith(ASSET_ID_PREFIX) ? await remoteIdOf(value) : value
      }

      if (typeof value !== 'object' || value === null) return value
      // Only the envelope of a body is validated (`parseGenerationBody`), so what is walked here
      // is renderer-shaped: a structured clone keeps the cycles it may hold, and walking one in
      // the main process would freeze every window rather than come back.
      if (seen.has(value)) return value
      seen.add(value)

      if (Array.isArray(value)) {
        const list: unknown[] = []
        for (const held of value) list.push(await rewrite(held))
        return list
      }

      const rewritten: Record<string, unknown> = {}
      for (const [key, held] of Object.entries(value)) rewritten[key] = await rewrite(held)
      return rewritten
    }

    /**
     * A list of pictures is observed — `referenceImages` is a `file_array`. Reaching under an
     * object is an ASSURANCE, not a fix for anything seen: the SDK types a model input that
     * carries its own inputs, and no model on this account publishes one. Left in because the
     * failure it guards is silent — an id that stays local is submitted, paid for, and answers
     * as though no reference had been given.
     */
    const resolved: Record<string, unknown> = {}
    seen.add(body)
    for (const [key, value] of Object.entries(body)) resolved[key] = await rewrite(value)
    return resolved
  }
}
