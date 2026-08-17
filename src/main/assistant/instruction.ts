import {
  actionsReaching,
  type ActionField,
  type AssistantAction,
  HISTORY_MAX,
  INSTRUCTION_MAX,
} from '@shared/domain/assistant'
import { englishText } from '@shared/i18n'

/**
 * What the model is told before it answers.
 *
 * Two kinds of sentence live here, and the difference is worth stating because they sit five
 * lines apart. The CATALOGUE — what each action is and what its fields mean — comes from the
 * English bundle, because those same sentences are shown on screen and one source is the only
 * way they stay one thing. `ROLE` and `FORMAT` are written here as literals, because they are
 * shown to nobody: they are a prompt, which is code, and putting a prompt in a translation
 * bundle would invite someone to translate the one thing that must not move.
 *
 * English throughout either way — see `englishText`, which the window uses for the other half of
 * the same conversation.
 */

/** One field, as a line the model can read: name, type, whether it must be there, what it takes. */
function fieldLine(field: ActionField): string {
  const parts = [`${field.key} (${field.kind}${field.required ? ', required' : ''})`]
  if (field.options) parts.push(`one of: ${field.options.join(', ')}`)
  parts.push(englishText(field.labelKey))
  return `    - ${parts.join(' — ')}`
}

function actionBlock(action: AssistantAction): string {
  const lines = [`  ${action.name} — ${englishText(action.descriptionKey)}`]
  for (const field of action.fields) lines.push(fieldLine(field))
  return lines.join('\n')
}

/**
 * The catalogue, as the model sees it — the share of the registry reaching `both` doors.
 *
 * Filtered rather than whole, and that is what lets the registry hold eighty actions: the whole
 * of it would be tens of thousands of characters against an `INSTRUCTION_MAX` of ten, and the
 * sentence the person typed is what the overflow would take off. What a program drives
 * deliberately — file trees, layer stacks, git — it finds through `tools/list` instead.
 *
 * Rebuilt on every call rather than cached: it is a few thousand characters against a round trip
 * that takes seconds, and a cache would be one more thing to invalidate.
 */
export function actionCatalogue(): string {
  return actionsReaching('both').map(actionBlock).join('\n')
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
export function instructionFor(utterance: string): string {
  const preamble = [
    ROLE,
    '',
    'Catalogue:',
    actionCatalogue(),
    '',
    FORMAT,
    '',
    'The person says:',
    '',
  ].join('\n')

  return preamble + utterance.slice(0, Math.max(0, INSTRUCTION_MAX - preamble.length))
}

/** What the fixed part of an instruction costs, leaving the rest of the budget to the sentence. */
export function preambleLength(): number {
  return instructionFor('').length
}
