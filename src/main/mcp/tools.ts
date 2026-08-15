import {
  ACTION_REGISTRY,
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

type FieldSchema = {
  type?: 'string' | 'number' | 'integer' | 'boolean'
  description: string
  enum?: string[]
  minimum?: number
  maximum?: number
}

/**
 * What each of our kinds is in JSON Schema.
 *
 * `raw` is the one with no type at all, and deliberately: it carries a generation model's own
 * parameters, whose shape is only known once `GET /models/{id}` has answered. Announcing it as
 * an object would be a promise the registry cannot keep — it may legitimately be a string.
 */
const JSON_TYPE: Record<FieldKind, FieldSchema['type']> = {
  text: 'string',
  longText: 'string',
  choice: 'string',
  color: 'string',
  image: 'string',
  number: 'number',
  integer: 'integer',
  seed: 'integer',
  boolean: 'boolean',
  raw: undefined,
}

function fieldSchema(field: ActionField): FieldSchema {
  const type = JSON_TYPE[field.kind]

  return {
    ...(type ? { type } : {}),
    description: englishText(field.labelKey),
    ...(field.options ? { enum: [...field.options] } : {}),
    ...(field.min === undefined ? {} : { minimum: field.min }),
    ...(field.max === undefined ? {} : { maximum: field.max }),
  }
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
  asset: 'Asks the person on screen first: it uploads an image that stays in their library.',
  credits: 'Asks the person on screen first, with an estimate: it spends creative units.',
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
    description: `${englishText(action.descriptionKey)} ${COMMITMENT_NOTE[action.commitment]}`,
    inputSchema: schemaOfFields(action.fields),
  }
}

/**
 * The catalogue, built once.
 *
 * The registry is a module constant and so is the English bundle it reads, so every `tools/list`
 * was rebuilding the same objects — a split-and-reduce over the bundle per action and per field.
 */
const TOOLS: readonly McpTool[] = ACTION_REGISTRY.map(toolOf)

export function mcpTools(): readonly McpTool[] {
  return TOOLS
}
