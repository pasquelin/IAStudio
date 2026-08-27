// SPDX-License-Identifier: MIT

import type { Component, ComponentType, JsonValue } from '@shared/domain/component'
import type { GameEventName } from '@shared/domain/gameEvent'
import type { Vector3 } from '@shared/domain/transform'
import type { InputState } from '../ports/inputPort'

/**
 * One scripted entity as the sandbox sees it — a COPY, never a handle onto the world.
 *
 * 🛑 Everything a script may read in a step is here, and it crosses the bridge ONCE for the whole
 * frame. Measured 2026-08-26: a bridge call costs 1,34 µs against 0,15 µs for a thousand of the
 * same operations inside the machine, so an API answering one property at a time pays it per
 * property per entity.
 */
export type ScriptEntity = {
  entity: string
  name: string
  position: Vector3
  rotation: Vector3
  components: readonly Component[]
  props: Readonly<Record<string, JsonValue>>
}

/** What one hook is given: the clock, the input, and every entity that runs a script. */
export type ScriptFrame = {
  tick: number
  dt: number
  input: InputState
  entities: readonly ScriptEntity[]
}

/**
 * What a script ASKED for, applied by the system afterwards through the world's own gestures.
 *
 * Deferred on purpose, twice over: it is what lets the whole frame cross the bridge in one call,
 * and it is what keeps a script from writing into a world being walked.
 */
export type ScriptIntent =
  | { act: 'move'; entity: string; by: Vector3 }
  | { act: 'place'; entity: string; at: Vector3 }
  | { act: 'turn'; entity: string; to: Vector3 }
  | { act: 'field'; entity: string; type: ComponentType; key: string; value: JsonValue }
  | { act: 'spawn'; name: string; at: Vector3 | null }
  | { act: 'destroy'; entity: string }
  | { act: 'emit'; name: GameEventName; entity: string | null; payload: Record<string, JsonValue> }
  | { act: 'log'; level: 'info' | 'warn' | 'error'; message: string }

/** What a script did wrong, where an editor could open it. */
export type ScriptFault = {
  /** The script's reference, as `refToString` spells one. */
  script: string
  /** The entity it was running for, when it was running for one. */
  entity: string | null
  message: string
  /** One-based, as an editor counts. Zero when the engine could not say. */
  line: number
  column: number
}

export type ScriptOutcome = {
  intents: readonly ScriptIntent[]
  faults: readonly ScriptFault[]
}

/** The hooks a fixed step drives. What events drive is named by the event itself. */
export type ScriptHook = 'onCreate' | 'onStart' | 'onUpdate' | 'onLateUpdate' | 'onDestroy'
