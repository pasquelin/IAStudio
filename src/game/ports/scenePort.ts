// SPDX-License-Identifier: MIT

import type { JsonValue } from '@shared/domain/component'

/**
 * What a running game asks of whoever holds its scenes.
 *
 * 🛑 `load` never answers: a world cannot replace itself mid-step, so the host takes the request
 * and swaps between two steps. What a caller learns is `SceneLoaded`, on the bus of the NEW world.
 */
export type ScenePort = {
  /** Asks for another scene of the project, veiling for that many seconds on the way through. */
  load: (scene: string, fade: number) => void
  /**
   * What survives a load. Pure JSON, for the reason a component's state is: what crosses a scene
   * boundary is what could cross a network one.
   */
  keep: (key: string, value: JsonValue) => void
  /** Everything kept, as ONE object: it rides in the frame rather than costing a call per key. */
  kept: () => Readonly<Record<string, JsonValue>>
}
