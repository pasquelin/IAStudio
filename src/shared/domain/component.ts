/**
 * What an entity DOES, beside what its `type` says it draws.
 *
 * The state of a component is pure JSON — no function, no three.js object, no closure. That one
 * decision is what makes serialisation, undo by `Command`, the `DynamicForm` inspector, the MCP
 * schema and network replication all possible at once. The BEHAVIOUR lives in a system.
 */
export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue }

/**
 * A closed union, like `ActionName`, so the compiler holds the list and MCP publishes it.
 *
 * 🛑 **A type is declared by the lot that gives it a SYSTEM.** A component nothing simulates is a
 * form field that does nothing, and thirty of them written ahead of their behaviour would be
 * thirty guesses. The physics ones arrive with Rapier, the script one with the sandbox.
 */
export type ComponentType = 'Health' | 'Movement'

export type Component = { type: ComponentType } & { readonly [key: string]: JsonValue }
