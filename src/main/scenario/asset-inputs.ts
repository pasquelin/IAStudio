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
 * Rewrites the local asset ids a form carries into the ids Scenario knows them by, sending what
 * has never gone up.
 *
 * The two vocabularies look alike and are not: the collector stamps a row with a fresh
 * `asset_<uuid>` and files the API's own id under `remoteAssetId`, so what a drop target hands
 * to a form is an identifier the API has never heard of. Left alone, a generation with a
 * reference picture is submitted, paid for, and answers as though no reference had been given.
 *
 * Two doors, one translator, because the callers hold two shapes and only one of them can be
 * walked blind: a generation body is of the model's own shape and nothing says which of its keys
 * is a picture, whereas prompt assistance holds a bare list and knows every entry is one. They
 * share the in-flight map below — a generation and an assistance naming the same never-sent
 * picture would otherwise both find no twin and both send the file, billed twice.
 *
 * What deliberately does NOT come through here: a cost estimate, which is asked on every
 * keystroke and must not send a file up for a figure nobody is waiting on. The estimate of a
 * form holding a picture is therefore made without it, and `referenceImages` is priced
 * (`cost_impact: true`) — so it can read low. That one is written down in `docs/todo.md`.
 */
export type AssetInputResolver = {
  /** A generation body, whose picture keys are the model's own and cannot be named in advance. */
  resolveBody: (body: Record<string, unknown>) => Promise<Record<string, unknown>>
  /**
   * A bare list of pictures — what prompt assistance holds instead of a body. The gesture that
   * reaches it is a click, never a keystroke, which is what makes the transfer expected.
   */
  resolvePictureIds: (images: readonly string[]) => Promise<string[]>
}

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

  /**
   * Bound to an owner read once per call: a switch mid-walk would judge two pictures of one run
   * against two different projects.
   */
  const remoteIdIn =
    (owner: string | null) =>
    async (localId: string): Promise<string> => {
      const asset = await find(localId)
      // Unanswered means "already the API's own", which is what an id pasted from the webapp is —
      // and both vocabularies share the `asset_` prefix, so nothing here can tell that apart from
      // a local id whose row was deleted while the form still held it. That one goes out as it
      // stands and is answered as though no reference had been given. Written down in
      // `docs/todo.md` under 6.2 rather than guessed at from the id's shape.
      if (!asset) return localId

      const standing = standingTwinOf(asset, owner)
      if (standing) return standing

      return await sendOnce(localId, owner)
    }

  const isLocal = (value: string): boolean => value.startsWith(ASSET_ID_PREFIX)

  const resolvePictureIds = async (images: readonly string[]): Promise<string[]> => {
    const remoteIdOf = remoteIdIn(activeOwnerId())
    const resolved: string[] = []

    // One at a time, like the body walk: an upload is an unbounded file transfer nothing here
    // paces, and it is what records a twin before the next lookup of the same id.
    for (const image of images) resolved.push(isLocal(image) ? await remoteIdOf(image) : image)

    return resolved
  }

  const resolveBody = async (body: Record<string, unknown>) => {
    const remoteIdOf = remoteIdIn(activeOwnerId())

    const seen = new WeakSet<object>()

    /** One value at a time, for the reason `resolvePictureIds` gives above. */
    const rewrite = async (value: unknown): Promise<unknown> => {
      if (typeof value === 'string') return isLocal(value) ? await remoteIdOf(value) : value

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

  return { resolveBody, resolvePictureIds }
}
