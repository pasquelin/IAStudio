// SPDX-License-Identifier: MIT

import type { JsonValue } from '@shared/domain/component'

/**
 * A closed union, like `ActionName` and `ComponentType`: the compiler holds the list, MCP
 * publishes it, Monaco completes it, and the timeline offers it. `Custom` is the escape hatch and
 * carries its name as DATA rather than widening the union.
 *
 * 🛑 Declared before they are all emitted — a name here is a contract with a script author, and
 * one added later than the surface that offers it is a name nobody can bind to.
 */
export type GameEventName =
  | 'GameStarted'
  | 'GamePaused'
  | 'GameStopped'
  | 'SceneLoading'
  | 'SceneLoaded'
  | 'EntitySpawned'
  | 'EntityDestroyed'
  | 'ObjectClicked'
  | 'TriggerEntered'
  | 'TriggerExited'
  | 'Collided'
  | 'HealthChanged'
  | 'Died'
  | 'Respawned'
  | 'ItemPicked'
  | 'ItemUsed'
  | 'AnimationFinished'
  | 'TimelineFinished'
  | 'VideoFinished'
  | 'SoundFinished'
  | 'UiOpened'
  | 'UiClosed'
  | 'UiAction'
  | 'PlayerJoined'
  | 'PlayerLeft'
  | 'Custom'

/**
 * Pure JSON, for the reason a component's state is: an event that travels to a log, to MCP or to
 * another machine cannot carry a closure or a three.js object.
 */
export type GameEvent = {
  name: GameEventName
  /** Which entity it happened to, when it happened to one. An id inside the world's scene. */
  entity?: string
  payload: { readonly [key: string]: JsonValue }
}
