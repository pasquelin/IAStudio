import type { ActionField } from './assistantAction'
import type { Component, ComponentType, JsonValue } from './component'
import type { GameEventName } from './gameEvent'

export type ComponentCategory =
  'transform' | 'render' | 'physics' | 'gameplay' | 'audio' | 'video' | 'ui' | 'ai' | 'net'

/**
 * Everything the studio knows about one kind of component, said ONCE.
 *
 * 🛑 `fields` is `ActionField`, the very type an assistant action declares its parameters with,
 * and that is the pivot of the whole design rather than a coincidence. The same list already
 * produces the MCP JSON Schema (`main/mcp/tools.ts`) and validates an input (`readInput`); reusing
 * it means a component written once also gets its inspector form, its schema, its validation, its
 * introspection and its Monaco declaration. One place to write, five surfaces served — invariant 5
 * of CLAUDE.md, applied to gameplay.
 *
 * The BEHAVIOUR is nowhere here: it lives in a system. A descriptor describes data.
 */
export type ComponentDescriptor = {
  type: ComponentType
  titleKey: string
  descriptionKey: string
  category: ComponentCategory
  fields: readonly ActionField[]
  /** One per field, and only fields — `componentRegistry.test.ts` holds the two together. */
  defaults: Readonly<Record<string, JsonValue>>
  /** What this one needs beside it. A `RigidBody` is meaningless without a `Collider`. */
  requires?: readonly ComponentType[]
  /** What it puts on the bus, so a script author can be told without reading the system. */
  events?: readonly GameEventName[]
}

/**
 * A field and its label, which is its key: written out, twelve of them repeated
 * `labelKey: 'game.fields.<key>'` and each was a chance for the two to drift.
 */
const numberField = (key: string, min: number, max?: number): ActionField => ({
  key,
  kind: 'number',
  labelKey: `game.fields.${key}`,
  required: true,
  min,
  ...(max === undefined ? {} : { max }),
})

const choiceField = (key: string, options: readonly string[]): ActionField => ({
  key,
  kind: 'choice',
  labelKey: `game.fields.${key}`,
  required: true,
  options,
})

const flagField = (key: string): ActionField => ({
  key,
  kind: 'boolean',
  labelKey: `game.fields.${key}`,
  required: true,
})

const HEALTH: ComponentDescriptor = {
  type: 'Health',
  titleKey: 'game.components.Health.title',
  descriptionKey: 'game.components.Health.description',
  category: 'gameplay',
  fields: [numberField('max', 1), numberField('current', 0)],
  defaults: { max: 100, current: 100 },
  events: ['HealthChanged', 'Died'],
}

const MOVEMENT: ComponentDescriptor = {
  type: 'Movement',
  titleKey: 'game.components.Movement.title',
  descriptionKey: 'game.components.Movement.description',
  category: 'gameplay',
  fields: [
    choiceField('axis', ['x', 'y', 'z']),
    numberField('speed', 0),
    numberField('distance', 0),
    choiceField('mode', ['once', 'loop', 'pingPong']),
  ],
  defaults: { axis: 'y', speed: 1, distance: 2, mode: 'pingPong' },
}

const COLLIDER: ComponentDescriptor = {
  type: 'Collider',
  titleKey: 'game.components.Collider.title',
  descriptionKey: 'game.components.Collider.description',
  category: 'physics',
  fields: [
    choiceField('fidelity', ['auto', 'box', 'hull', 'convexes', 'trimesh']),
    numberField('friction', 0, 2),
    numberField('restitution', 0, 1),
  ],
  // `auto` reads the fidelity ADR-25 already writes into a carved solid, and takes the exact
  // primitive for anything else. The four other words are the author overruling that.
  defaults: { fidelity: 'auto', friction: 0.6, restitution: 0 },
}

const RIGID_BODY: ComponentDescriptor = {
  type: 'RigidBody',
  titleKey: 'game.components.RigidBody.title',
  descriptionKey: 'game.components.RigidBody.description',
  category: 'physics',
  fields: [
    choiceField('kind', ['dynamic', 'fixed', 'kinematic']),
    numberField('mass', 0, 10_000),
    numberField('gravityScale', -5, 5),
    flagField('lockRotation'),
  ],
  // A mass of zero is the engine weighing the shape itself, which is what an author means by
  // « a crate » — a number here is for the crate that has to feel heavier than it looks.
  defaults: { kind: 'dynamic', mass: 0, gravityScale: 1, lockRotation: false },
  // No `requires`, and it was written and taken back out: a body with no `Collider` beside it
  // still falls — the volume comes from what the node DRAWS, and the component only tunes it.
  events: ['Collided'],
}

const TRIGGER: ComponentDescriptor = {
  type: 'Trigger',
  titleKey: 'game.components.Trigger.title',
  descriptionKey: 'game.components.Trigger.description',
  category: 'physics',
  // No field, and not an oversight: a trigger is a MARK on a volume the `Collider` already
  // describes. What it does when something enters belongs to a script, which is the next lot.
  fields: [],
  defaults: {},
  events: ['TriggerEntered', 'TriggerExited'],
}

const CHARACTER_CONTROLLER: ComponentDescriptor = {
  type: 'CharacterController',
  titleKey: 'game.components.CharacterController.title',
  descriptionKey: 'game.components.CharacterController.description',
  category: 'physics',
  // The pace, the pull and the eye height are NOT here: they are the scene's, in `world.play`,
  // so that a template meaning « first person, feet on the ground » says it once for the set.
  fields: [
    numberField('height', 0.2, 10),
    numberField('radius', 0.05, 5),
    numberField('jumpSpeed', 0, 50),
    numberField('stepHeight', 0, 2),
    numberField('slopeLimit', 0, 89),
    numberField('snapDistance', 0, 2),
  ],
  defaults: {
    height: 1.8,
    radius: 0.3,
    jumpSpeed: 5,
    stepHeight: 0.5,
    slopeLimit: 45,
    snapDistance: 0.5,
  },
  events: ['Collided'],
}

const SCRIPT: ComponentDescriptor = {
  type: 'Script',
  titleKey: 'game.components.Script.title',
  descriptionKey: 'game.components.Script.description',
  category: 'gameplay',
  // 🛑 ONE declared field. What a script exposes differs per script, so those rows are read off
  // the file's own `props` and written beside this one — see `scriptProps`. Absent by default:
  // a component nobody has set carries nothing, and `settingsOf` answers the author's own words.
  fields: [{ key: 'script', kind: 'text', labelKey: 'game.fields.script', required: true }],
  defaults: { script: '' },
}

/**
 * 🛑 A `Record<ComponentType, …>`, so the COMPILER refuses a type declared without a descriptor.
 * A component nothing describes has no form, no schema and no documentation — it is a name in a
 * union that no surface can offer.
 */
export const COMPONENTS: Record<ComponentType, ComponentDescriptor> = {
  Health: HEALTH,
  Movement: MOVEMENT,
  Collider: COLLIDER,
  RigidBody: RIGID_BODY,
  Trigger: TRIGGER,
  CharacterController: CHARACTER_CONTROLLER,
  Script: SCRIPT,
}

export const COMPONENT_TYPES: readonly ComponentType[] =
  Object.keys(COMPONENTS).filter(isComponentType)

export function isComponentType(value: unknown): value is ComponentType {
  return typeof value === 'string' && Object.hasOwn(COMPONENTS, value)
}

export function descriptorOf(type: ComponentType): ComponentDescriptor {
  return COMPONENTS[type]
}

/** A component of that type at its defaults — what adding one from the inspector writes. */
export function newComponent(type: ComponentType): Component {
  return { ...COMPONENTS[type].defaults, type }
}

/**
 * The word a client sent, read as the field declares it — or nothing when it does not fit.
 *
 * 🛑 The bounds are enforced HERE and nowhere else. A component's value travels as text (a schema
 * naming every field of every type would describe none of them), so `options`, `min` and `max`
 * are read by no client and by no validator: without this an `axis` of `north` is written into
 * the document verbatim, saved into the `.gltf`, matched by no system, and refused on reload by
 * nothing.
 *
 * Refused rather than clamped: a caller told its value did not fit corrects it, where a caller
 * silently given another number believes it wrote the one it asked for.
 */
export function componentValueOf(field: ActionField, said: string): JsonValue | null {
  if (field.kind === 'boolean') return said === 'true' ? true : said === 'false' ? false : null
  if (field.kind === 'choice') return (field.options ?? []).includes(said) ? said : null
  if (field.kind !== 'number' && field.kind !== 'integer') return said

  const value = Number(said)
  if (!Number.isFinite(value)) return null
  if (field.kind === 'integer' && !Number.isInteger(value)) return null
  if (field.min !== undefined && value < field.min) return null

  return field.max !== undefined && value > field.max ? null : value
}

/**
 * A component with one field written, dropping a value the descriptor does not name.
 *
 * The drop is the point: an inspector form and an MCP call both hand over whatever they were
 * given, and a key nobody declared would ride into the document and out again for ever.
 */
export function withComponentField(component: Component, key: string, value: JsonValue): Component {
  if (!COMPONENTS[component.type].fields.some(field => field.key === key)) return component
  return { ...component, [key]: value, type: component.type }
}
