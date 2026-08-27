// SPDX-License-Identifier: MIT

import type { JsonValue } from '@shared/domain/component'
import type { GameEvent } from '@shared/domain/gameEvent'
import type {
  ScriptEntity,
  ScriptFault,
  ScriptFrame,
  ScriptHook,
  ScriptOutcome,
} from '../script/frame'

/** A script's source, already turned into what a sandbox can run. */
export type ScriptModule = { script: string; code: string }

/** One entity running one script, with the settings its author gave that instance. */
type ScriptInstance = {
  entity: string
  script: string
  props: Readonly<Record<string, JsonValue>>
}

/**
 * Where a game's own code runs, and the only thing between it and the studio.
 *
 * 🛑 The code inside is written by whoever plays — increasingly by a model — so it must be assumed
 * wrong, slow or hostile: no `fetch`, no `WebSocket`, no clock of its own, and INTERRUPTED when it
 * overruns. What it asks for comes back as intents the caller applies.
 */
export type ScriptPort = {
  /** The world's own seed, so `game.random` replays with the rest of a session. */
  seed: (value: number) => void
  /** Compiles each module once. A fault here belongs to the whole script, not to an entity. */
  load: (modules: readonly ScriptModule[]) => readonly ScriptFault[]
  attach: (instances: readonly ScriptInstance[]) => readonly ScriptFault[]
  /**
   * Runs `onDestroy` on its way out, off the SNAPSHOT the caller hands it: by then the world no
   * longer holds the entity, and a frame swept from it would name the survivors instead.
   */
  detach: (leaving: readonly ScriptEntity[]) => ScriptOutcome
  /**
   * Whether any living instance declares that hook. What lets a caller skip a crossing whole: the
   * frame would otherwise be serialized to discover, per entity, that nobody wrote it.
   */
  declares: (hook: string) => boolean
  /** One crossing for the whole frame — every instance's hook, in one call. */
  run: (hook: ScriptHook, frame: ScriptFrame) => ScriptOutcome
  /** The same, for what the bus delivered between two steps. */
  deliver: (frame: ScriptFrame, events: readonly GameEvent[]) => ScriptOutcome
  /** Hands the frame budget back. Called once per RENDERED frame — see `SCRIPT_BUDGET_MS`. */
  refill: () => void
  /** Whoever overran or threw too often, and will not be run again this session. */
  disarmed: () => readonly string[]
  dispose: () => void
}

/**
 * How long every script of one RENDERED frame gets, together — spent across however many fixed
 * steps that frame carries, which the clamp of `MAX_FRAME_SECONDS` puts at fifteen. The spike of
 * 2026-08-26 read 200 scripted entities at 0,571 ms, so this is some seven times a full sweep.
 */
export const SCRIPT_BUDGET_MS = 4

/** How many times an instance may throw before it stops being run at all. */
export const FAULTS_BEFORE_DISARM = 3
