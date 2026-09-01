// SPDX-License-Identifier: MIT

/**
 * What an author's script sees, and the ONLY thing it sees.
 *
 * 🛑 One source, three readers: this text is served to Monaco so an editor can type a script, it
 * names what `kernel.ts` builds inside the sandbox, and the MCP documentation quotes it. Nothing
 * generates it — `studioApi.test.ts` holds it against the kernel instead, which is the half a
 * typecheck cannot see: the kernel ships as TEXT.
 */

declare module '@studio' {
  /**
   * 🛑 What the PROJECT declares, layered in by its own `.d.ts` — see `projectTypes`.
   *
   * An interface so the project's declaration MERGES into it; empty here so a script still types
   * with no project loaded, and every name below then widens back to `string`.
   */
  /* eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/consistent-type-definitions -- an INTERFACE and empty on purpose: only an interface merges with the project's own declaration, and a member here would be one the project cannot override */
  export interface StudioNames {}

  /** A family of the project, or a plain string while nothing declared it. */
  type Named<Family extends string> = StudioNames extends Record<Family, infer Held> ? Held : string

  /** A component type the studio has a descriptor for. Refused if the project has no such one. */
  export type ComponentName = Named<'components'>

  export type Vector3 = { x: number; y: number; z: number }

  /** One of the components an entity carries, as plain JSON. `type` names which. */
  export type Component = { type: string; [field: string]: unknown }

  /**
   * The entity a hook is running for. Every gesture is DEFERRED — see `defineScript`.
   *
   * `P` is what THIS script declared in `props`, so `self.props.speed` is a number rather than
   * an `unknown` the author has to widen — the default is what a hook typed by hand still gets.
   */
  export type Self<P = Record<string, unknown>> = {
    /** The entity's own id, stable for as long as it lives. */
    readonly id: string
    readonly name: string
    /**
     * What the inspector set on THIS instance of the script, over what `props` declared.
     *
     * The index stays open beside the declared keys: `kernel.ts` layers EVERY key an instance
     * carries, declared or not — a prop taken out of the block but left in the scene is still
     * there at runtime, and reading it must not be a compile error.
     */
    readonly props: Readonly<P & Record<string, unknown>>
    /** Where it is at the start of the step. Moving it is `moveBy` or `placeAt`. */
    readonly position: Readonly<Vector3>
    readonly rotation: Readonly<Vector3>
    /** The component of that type, or `null` when the entity does not carry one. */
    get(type: ComponentName): Component | null
    has(type: ComponentName): boolean
    /** Moves BY that much, in metres. Applied at the end of the step. */
    moveBy(x: number, y: number, z: number): void
    /** Moves TO that place, in metres. */
    placeAt(x: number, y: number, z: number): void
    /** Turns to that rotation, in radians. */
    turnTo(x: number, y: number, z: number): void
    /** Writes one field of one component the entity ALREADY carries. */
    set(type: ComponentName, key: string, value: unknown): void
    /** Puts a named event on the bus, carrying this entity. Heard by every `onMessage`. */
    say(name: string, payload?: Record<string, unknown>): void
    /** Asks for this entity to be destroyed at the end of the step. */
    destroy(): void
  }

  /** The step itself: its clock and what the player is doing. */
  export type Context = {
    /** How many fixed steps have run. A tick is the unit the network counts in. */
    readonly tick: number
    /** How long one step lasts, in seconds. Constant at 1/60. */
    readonly dt: number
    readonly input: {
      /** Whether the key is held down right now. `code` is a `KeyboardEvent.code`. */
      down(code: string): boolean
      /** Whether it went down during THIS step. */
      pressed(code: string): boolean
      /** Whether it came up during this step. */
      released(code: string): boolean
      readonly pointer: { readonly x: number; readonly y: number; readonly down: boolean }
    }
  }

  /** What an event hook is handed: what happened, and to whom. */
  export type GameEvent = {
    readonly name: string
    readonly entity: string | null
    readonly payload: Readonly<Record<string, unknown>>
  }

  /** What `game.ai` answers today: a refusal, named. Spending is not granted to a script. */
  export type Refused = { readonly ok: false; readonly refused: 'notGranted' }

  /**
   * 🛑 The whole surface. No `fetch`, no `WebSocket`, no clock, no `Math.random` worth replaying —
   * the time comes from `ctx`, and the draw comes from here so a session replays.
   */
  export const game: {
    log: {
      info(message: unknown): void
      warn(message: unknown): void
      error(message: unknown): void
    }
    events: {
      /** Puts a named event on the bus, belonging to no entity. */
      emit(name: string, payload?: Record<string, unknown>): void
    }
    /** Asks for an entity of that name, at that place. Born at the end of the step. */
    spawn(name: string, at?: Vector3): void
    scene: {
      /**
       * Asks for another scene of the project — its document, by title or by id.
       *
       * 🛑 It does not wait, and nothing after it runs in the new scene: a world cannot replace
       * itself mid-step. Listen for `SceneLoaded`, which arrives on the new scene's own bus.
       */
      load(scene: string, options?: { fade?: number }): void
      /** Puts a value aside for the scene AFTER this one. Pure JSON, like every payload. */
      keep(key: string, value: unknown): void
      /** What a former scene put aside, or `null`. Read off the step, so it costs nothing. */
      kept(key: string): unknown
    }
    random: {
      /** In `[0, 1)`, from the world's own seed: the same session replays the same numbers. */
      float(): number
      /** In `[low, high)`. */
      int(low: number, high: number): number
    }
    /** Named and refusing: a fixed step cannot wait, and spending is not granted. */
    ai: {
      generateImage(): Refused
      generateDialogue(): Refused
      generateAudio(): Refused
    }
  }

  /**
   * What a script IS. Every hook is optional; what is not written never crosses the bridge.
   *
   * ```ts
   * import { defineScript } from '@studio'
   * export default defineScript({
   *   onUpdate(self, ctx, dt) {
   *     if (ctx.input.down('KeyW')) self.moveBy(0, 0, -4 * dt)
   *   },
   * })
   * ```
   */
  // 🛑 NO default on `P`: `Record<string, never>` was tried, and `never` is assignable to
  // everything — a script reading a prop it never declared compiled clean and multiplied an
  // `undefined` at runtime. With none, `P` falls back on the constraint, which stays red.
  export function defineScript<P extends Record<string, string | number | boolean>>(definition: {
    /**
     * What this script exposes to the inspector, with the default each one takes.
     *
     * 🛑 A plain value, always — a number, a switch or a word. It is read off the FILE before the
     * script has ever run, so an expression is left out rather than guessed at, and what the
     * inspector set on an instance is layered over it in `self.props`.
     */
    props?: P
    /** Once, when the entity joins — before its first step. */
    onCreate?(self: Self<P>, ctx: Context): void
    /** Once, on the world's first step, after everything exists. */
    onStart?(self: Self<P>, ctx: Context, dt: number): void
    /** Every fixed step. `dt` is `ctx.dt`, handed over for what a movement is written against. */
    onUpdate?(self: Self<P>, ctx: Context, dt: number): void
    /** Once per RENDERED frame, after every step of it. */
    onLateUpdate?(self: Self<P>, ctx: Context, dt: number): void
    /** Once, on its way out. The entity has already left the world. */
    onDestroy?(self: Self<P>, ctx: Context): void
    /** Every event on the bus, whoever it happened to. */
    onMessage?(self: Self<P>, ctx: Context, event: GameEvent): void
    /** When something hit THIS entity. */
    onCollision?(self: Self<P>, ctx: Context, event: GameEvent): void
    onTriggerEnter?(self: Self<P>, ctx: Context, event: GameEvent): void
    onTriggerExit?(self: Self<P>, ctx: Context, event: GameEvent): void
  }): unknown
}
