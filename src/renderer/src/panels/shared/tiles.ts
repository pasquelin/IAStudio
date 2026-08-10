import { DEFAULT_COLLECTION_STATE, type CollectionState } from '@/helpers/collection-state'

/**
 * How many pictures a shelf panel asks for.
 *
 * These are panels to glance at, not the asset browser: they page no further, and the number is
 * theirs rather than a user setting because a column has no bar to put one on. It was a
 * per-section limit while they were bands of the page, which is the control the rail replaced.
 */
export const PANEL_PAGE = 24

/**
 * Pictures in a narrow column: a grid of small squares, with neither search nor facets.
 *
 * A module constant so the identity is stable — `Collection` re-measures its grid whenever this
 * changes, and an object rebuilt each render would re-measure on every one of them.
 */
export const TILE_COLLECTION: CollectionState = { ...DEFAULT_COLLECTION_STATE, thumbnailSize: 96 }
