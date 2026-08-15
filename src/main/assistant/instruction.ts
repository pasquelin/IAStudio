import {
  ACTION_REGISTRY,
  type ActionField,
  type AssistantAction,
  HISTORY_MAX,
  INSTRUCTION_MAX,
} from '@shared/domain/assistant'
import { isRecord } from '@shared/guards'
import { TRANSLATIONS } from '@shared/i18n'

/**
 * What the model is told before it answers.
 *
 * Written from the English bundle rather than from sentences in this file, for the reason every
 * word bound for a screen is: there are no sentences in `src/`. English specifically — the model
 * reasons in it, and the same catalogue read in French would change what it decides from one
 * user to the next.
 */

function english(key: string): string {
  const text = key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined),
      TRANSLATIONS.en)
  return typeof text === 'string' ? text : ''
}

/** One field, as a line the model can read: name, type, whether it must be there, what it takes. */
function fieldLine(field: ActionField): string {
  const parts = [`${field.key} (${field.kind}${field.required ? ', required' : ''})`]
  if (field.options) parts.push(`one of: ${field.options.join(', ')}`)
  parts.push(english(field.labelKey))
  return `    - ${parts.join(' — ')}`
}

function actionBlock(action: AssistantAction): string {
  const lines = [`  ${action.name} — ${english(action.descriptionKey)}`]
  for (const field of action.fields) lines.push(fieldLine(field))
  return lines.join('\n')
}

/**
 * The catalogue, as the model sees it.
 *
 * Rebuilt on every call rather than cached: it is a few hundred characters, and a cache would
 * be one more thing to invalidate the day an action is added.
 */
export function actionCatalogue(actions: readonly AssistantAction[] = ACTION_REGISTRY): string {
  return actions.map(actionBlock).join('\n')
}

/**
 * The shape the answer has to take.
 *
 * Stated twice — as a sentence and as an example — because the one thing this whole file exists
 * to obtain is a parseable object, and the cheapest model on the list is the one most likely to
 * wrap it in prose if only told once.
 */
const FORMAT = [
  'Answer with one JSON object and nothing else. No prose around it, no code fence.',
  'The object has exactly two keys:',
  '  "say": a short sentence for the person, in their language. May be empty.',
  '  "calls": a list of actions to run, in order. May be empty.',
  'Each call is {"action": "<name from the catalogue>", "input": {<the fields above>}}.',
  'Example: {"say":"Opening a 3D file.","calls":[{"action":"workspace.open",',
  '"input":{"workspace":"3d","createDocument":true}}]}',
].join('\n')

const ROLE = [
  'You drive Scenario Studio, a desktop application for generating images, video, 3D models,',
  'audio, textures and skyboxes. The person talks to you and you act on their behalf.',
  '',
  'Rules:',
  '  - Only use actions from the catalogue below. Never invent one.',
  '  - Prefer doing over asking. Ask only when the request could mean two different things.',
  '  - generator.prepare fills the form and stops. generator.submit sends it and spends credits.',
  '  - If nothing in the catalogue fits, return no calls and say so in "say".',
].join('\n')

/**
 * Trims the history to what the model will actually be given.
 *
 * The oldest turns go first: a conversation is understood from its end, and the sentence just
 * spoken matters more than the one before the one before it.
 */
export function recentHistory(history: readonly string[], limit = HISTORY_MAX): string[] {
  return [...history].slice(-limit)
}

/**
 * Everything the model is told, for one turn.
 *
 * Capped at what the API accepts, and the cap falls on the utterance rather than on the whole:
 * trimming the end would take off the very sentence the person typed and leave the catalogue
 * intact, which is exactly backwards. A long paste is cut; the instructions always arrive whole.
 *
 * The preamble is fixed and short — under two thousand characters — so the budget left for a
 * sentence is most of the ten thousand. `preambleLength` is exported so a test can say that out
 * loud rather than trusting it: an action added with a florid description is the one thing that
 * could quietly eat it.
 */
export function instructionFor(
  utterance: string,
  actions: readonly AssistantAction[] = ACTION_REGISTRY,
): string {
  const preamble = [ROLE, '', 'Catalogue:', actionCatalogue(actions), '', FORMAT, '', 'The person says:', '']
    .join('\n')

  return preamble + utterance.slice(0, Math.max(0, INSTRUCTION_MAX - preamble.length))
}

/** What the fixed part of an instruction costs, leaving the rest of the budget to the sentence. */
export function preambleLength(actions: readonly AssistantAction[] = ACTION_REGISTRY): number {
  return instructionFor('', actions).length
}
