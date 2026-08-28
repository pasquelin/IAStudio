import {
  actionsReaching,
  type ActionCommitment,
  type ActionField,
  type ActionName,
  type AssistantAction,
  assistantAction,
} from '@shared/domain/assistant'
import type { FieldKind } from '@shared/domain/model'
import { englishText } from '@shared/i18n'

/**
 * `ACTION_REGISTRY`, published as MCP tools.
 *
 * The registry has one definition and two readers — the assistant inside the window, which
 * lists it to its model as a vocabulary, and this, which lists it to whatever client connects.
 * Nothing here decides what the studio can do; it only says it in the other dialect.
 */

/** The subset of JSON Schema an action's inputs need. Written out rather than pulled in. */
export type JsonSchema = {
  type: 'object'
  properties: Record<string, FieldSchema>
  required: string[]
  additionalProperties: false
}

type ScalarSchema = {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object'
  description: string
  enum?: string[]
  /** The keys a `record` accepts. `enum` would close the VALUE, which is not what is known. */
  propertyNames?: { enum: string[] }
  minimum?: number
  maximum?: number
}

type FieldSchema = ScalarSchema | { type: 'array'; description: string; items: ScalarSchema }

/**
 * What each of our kinds is in JSON Schema.
 *
 * `raw` is the one with no type at all, and deliberately: it carries a generation model's own
 * parameters, whose shape is only known once `GET /models/{id}` has answered. Announcing it as
 * an object would be a promise the registry cannot keep — it may legitimately be a string.
 * `record` is the case that was wrongly wearing `raw`: an object whose keys this repository knows.
 */
const JSON_TYPE: Record<FieldKind, ScalarSchema['type']> = {
  text: 'string',
  longText: 'string',
  choice: 'string',
  color: 'string',
  image: 'string',
  mesh: 'string',
  number: 'number',
  integer: 'integer',
  seed: 'integer',
  boolean: 'boolean',
  raw: undefined,
  record: 'object',
}

function scalarSchema(field: ActionField): ScalarSchema {
  const type = JSON_TYPE[field.kind]

  // A `record`'s options name its KEYS, not the values it may hold — the same list, read on the
  // other side of the colon.
  const closed = field.options
    ? field.kind === 'record'
      ? { propertyNames: { enum: [...field.options] } }
      : { enum: [...field.options] }
    : {}

  return {
    ...(type ? { type } : {}),
    description: englishText(field.labelKey),
    ...closed,
    ...boundsOf(field, type),
  }
}

/**
 * 🛑 `minimum`/`maximum` are NUMERIC keywords: emitted on a `{type: 'string'}` they are ignored by
 * every validator, so the contract announced a bound nobody applied. A string is bounded by
 * `maxLength`, and `min`/`max` on a text field mean a length — that is what `fits` reads too.
 */
function boundsOf(field: ActionField, type: string | undefined): Record<string, number> {
  const bounded =
    type === 'string' ? { min: 'minLength', max: 'maxLength' } : { min: 'minimum', max: 'maximum' }

  return {
    ...(field.min === undefined ? {} : { [bounded.min]: field.min }),
    ...(field.max === undefined ? {} : { [bounded.max]: field.max }),
  }
}

function fieldSchema(field: ActionField): FieldSchema {
  const scalar = scalarSchema(field)
  if (!field.repeated) return scalar

  return { type: 'array', description: scalar.description, items: scalar }
}

export function schemaOfFields(fields: readonly ActionField[]): JsonSchema {
  return {
    type: 'object',
    properties: Object.fromEntries(fields.map(field => [field.key, fieldSchema(field)])),
    required: fields.filter(field => field.required).map(field => field.key),
    // Closed on purpose: a client that invents a key is a client whose call would be validated
    // against the registry and refused anyway, and saying so in the schema saves the round trip.
    additionalProperties: false,
  }
}

/**
 * What the client is told an action engages, appended to its own description.
 *
 * On the tool rather than left to be discovered: a client that knows a call will ask the person
 * first can say so before making it, instead of appearing to hang for the two minutes the
 * question is allowed to stand.
 */
const COMMITMENT_NOTE: Record<ActionCommitment, string> = {
  none: 'Runs straight away.',
  files: 'Asks the person on screen first: it changes files in their project folder.',
  asset: 'Asks the person on screen first: it uploads an image that stays in their library.',
  remote:
    'Asks the person on screen first: it publishes to a server, and nothing here undoes that.',
  studio:
    'Asks the person on screen first, and cannot be delegated: it changes the settings, the ' +
    'account that answers, or the project that is open.',
  credits: 'Asks the person on screen first, with an estimate: it spends creative units.',
}

// The two ways `commitment` alone lies. `raises` lifts the floor from the input; `asksItself`
// marks a handler that raises the studio's own question, which is WHY its commitment is `none`.
// Read alone, `commitment` sent both out as "Runs straight away".
const OVERRIDE_NOTE = {
  asksItself:
    'Some calls wait on the person at the screen: the studio raises its own question rather than a confirmation.',
  raises: 'What one call engages depends on what is given: it may ask the person on screen first.',
}

function noteOf(action: AssistantAction): string {
  if (action.asksItself) return OVERRIDE_NOTE.asksItself
  if (action.raises) return OVERRIDE_NOTE.raises

  return COMMITMENT_NOTE[action.commitment]
}

export type McpTool = {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
}

/**
 * The tool name for an action.
 *
 * The dot has to go: an action is `command.run` here, and the tool-name grammar clients hold us
 * to accepts letters, digits, underscore and dash only. One substitution, reversed by
 * `actionOfTool`, rather than a second column in the registry that could drift from the first.
 */
export function toolName(action: ActionName): string {
  return action.replace('.', '_')
}

export function actionOfTool(name: string): AssistantAction | null {
  return assistantAction(name.replace('_', '.'))
}

function toolOf(action: AssistantAction): McpTool {
  return {
    name: toolName(action.name),
    title: englishText(action.titleKey),
    description: `${englishText(action.descriptionKey)} ${noteOf(action)}`,
    inputSchema: schemaOfFields(action.fields),
  }
}

/**
 * The catalogue, built once.
 *
 * The registry is a module constant and so is the English bundle it reads, so every `tools/list`
 * was rebuilding the same objects — a split-and-reduce over the bundle per action and per field.
 */
const TOOLS: readonly McpTool[] = actionsReaching('mcp').map(toolOf)

export function mcpTools(): readonly McpTool[] {
  return TOOLS
}
