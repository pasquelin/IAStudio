import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { useAssets } from './assets'
import { useDocuments } from './documents'

/** The two things a path is resolved against, as identities. */
export type Resolvers = { shelf: readonly Asset[]; listing: readonly DocumentDescriptor[] }

/**
 * For a file naming its pictures by a path RELATIVE to its folder: read before the catalogue has
 * landed, they resolve to nothing, and a once-only read would keep that for the session. A read
 * that HAD both and still missed names a file that is gone — retried, it re-reads a whole ingest.
 */
export const PATH_RESOLVERS = {
  against: (): Resolvers => ({
    shelf: useAssets.getState().items,
    listing: useDocuments.getState().stored,
  }),
  landed: ({ shelf, listing }: Resolvers): boolean =>
    (shelf.length === 0 && useAssets.getState().items.length > 0) ||
    (listing.length === 0 && useDocuments.getState().stored.length > 0),
}
