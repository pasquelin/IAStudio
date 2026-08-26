// SPDX-License-Identifier: MIT

import type { Ref } from '@shared/domain/ref'

/**
 * Where the bytes live, for the host the game runs in. A reference rather than an identifier, so
 * the port can REFUSE what it cannot serve — a document, a script — instead of guessing.
 */
export type AssetPort = {
  urlOf: (ref: Ref) => string | null
}
