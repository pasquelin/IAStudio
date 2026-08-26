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

const HEALTH: ComponentDescriptor = {
  type: 'Health',
  titleKey: 'game.components.Health.title',
  descriptionKey: 'game.components.Health.description',
  category: 'gameplay',
  fields: [
    { key: 'max', kind: 'number', labelKey: 'game.fields.max', required: true, min: 1 },
    { key: 'current', kind: 'number', labelKey: 'game.fields.current', required: true, min: 0 },
  ],
  defaults: { max: 100, current: 100 },
  events: ['HealthChanged', 'Died'],
}

const MOVEMENT: ComponentDescriptor = {
  type: 'Movement',
  titleKey: 'game.components.Movement.title',
  descriptionKey: 'game.components.Movement.description',
  category: 'gameplay',
  fields: [
    {
      key: 'axis',
      kind: 'choice',
      labelKey: 'game.fields.axis',
      required: true,
      options: ['x', 'y', 'z'],
    },
    { key: 'speed', kind: 'number', labelKey: 'game.fields.speed', required: true, min: 0 },
    { key: 'distance', kind: 'number', labelKey: 'game.fields.distance', required: true, min: 0 },
    {
      key: 'mode',
      kind: 'choice',
      labelKey: 'game.fields.mode',
      required: true,
      options: ['once', 'loop', 'pingPong'],
    },
  ],
  defaults: { axis: 'y', speed: 1, distance: 2, mode: 'pingPong' },
}

/**
 * 🛑 A `Record<ComponentType, …>`, so the COMPILER refuses a type declared without a descriptor.
 * A component nothing describes has no form, no schema and no documentation — it is a name in a
 * union that no surface can offer.
 */
export const COMPONENTS: Record<ComponentType, ComponentDescriptor> = {
  Health: HEALTH,
  Movement: MOVEMENT,
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
 * A component with one field written, dropping a value the descriptor does not name.
 *
 * The drop is the point: an inspector form and an MCP call both hand over whatever they were
 * given, and a key nobody declared would ride into the document and out again for ever.
 */
export function withComponentField(component: Component, key: string, value: JsonValue): Component {
  if (!COMPONENTS[component.type].fields.some(field => field.key === key)) return component
  return { ...component, [key]: value, type: component.type }
}
