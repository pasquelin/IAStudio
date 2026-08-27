// SPDX-License-Identifier: MIT

import type { JsonValue } from '@shared/domain/component'

/**
 * What a game puts aside for the scene after this one.
 *
 * 🛑 One OBJECT rather than a map: it rides in the script frame, and a `Map` does not serialize.
 */
export type KeptStore = {
  keep: (key: string, value: JsonValue) => void
  kept: () => Readonly<Record<string, JsonValue>>
}

export function createKeptStore(): KeptStore {
  // 🛑 No prototype: `keep('__proto__', …)` on a plain object writes no own property, so the key
  // would vanish without a word — and the value would land on the store's prototype instead.
  const held: Record<string, JsonValue> = Object.create(null)

  return {
    keep: (key, value) => {
      held[key] = value
    },
    kept: () => held,
  }
}
