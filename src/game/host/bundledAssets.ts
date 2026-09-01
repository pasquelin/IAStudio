// SPDX-License-Identifier: MIT

import type { AssetPort } from '../ports/assetPort'

/** Files shipped beside the page; a table written at export time says which one an id names. */
export function createBundledAssets(files: Readonly<Record<string, string>>): AssetPort {
  // `hasOwn`: a plain record answers `constructor` and `__proto__` with something that is not
  // a URL, and `?? null` never sees it.
  return {
    urlOf: ref =>
      ref.kind === 'asset' && Object.hasOwn(files, ref.id) ? (files[ref.id] ?? null) : null,
  }
}
