import type { ActivityReport } from '@main/project/activityLog'
import { noteText, type AssistantNote } from '@shared/domain/assistantNote'
import { defined } from '@shared/guards'

/**
 * One note as the journal keeps it.
 *
 * 🛑 The HEAD of a prompt and never the whole — see `NOTE_TEXT_MAX`. The whole is in the
 * transcript file.
 */
export function reportOfNote(note: AssistantNote, said?: string): ActivityReport {
  const shown = saidOf(note, said)
  // Cut ONCE, here: an arm left unbounded is a row of a database nothing holds back.
  return {
    topic: 'assistant',
    level: 'info',
    ...shown,
    ...(shown.detail === undefined ? {} : { detail: noteText(shown.detail) }),
  }
}

type Said = Omit<ActivityReport, 'topic' | 'level'> & { level?: ActivityReport['level'] }

function saidOf(note: AssistantNote, said?: string): Said {
  switch (note.kind) {
    case 'sent':
      // 🛑 A KEY and no detail — see `StudioBridge.assistant.said` for why a prompt does not
      // enter a database the project carries.
      return {
        messageKey: 'activity.assistantSent',
        params: {
          door: note.door,
          model: note.model,
          chars: note.text.length,
          ...defined({ said }),
        },
      }
    case 'answered':
      // 🛑 No key: an answer is short and its whole text is the `detail` right here. Given one,
      // the row grew a « see what was SENT » button that unfolded the answer a second time.
      return {
        messageKey: 'activity.assistantAnswered',
        params: { chars: note.text.length },
        detail: note.text,
      }
    case 'asked':
      // The dismissal is the answer that ends a turn, so it is said rather than left blank.
      return {
        messageKey: 'activity.assistantAsked',
        params: { question: note.question },
        detail: askedDetail(note),
      }
    case 'ran':
      return {
        // 🛑 `warn` and never `error`: `isToastWorthy` turns an error into a toast, and every
        // refused call of a plan would raise one.
        level: note.refused ? 'warn' : 'info',
        messageKey: note.refused ? 'activity.assistantRefused' : 'activity.assistantRan',
        params: { action: note.action },
        detail: `${note.input} → ${note.answer}`,
      }
  }
}

/** The note travels with the answer: for a question that offered one, it IS the answer. */
const askedDetail = (note: Extract<AssistantNote, { kind: 'asked' }>): string =>
  note.note === undefined ? (note.answer ?? '') : `${note.answer ?? ''} (${note.note})`.trim()

/** The same note as a sentence — cut for `main.log`, whole for the transcript. */
export function lineOfNote(note: AssistantNote): string {
  switch (note.kind) {
    case 'sent':
      return `sent to ${note.door}:\n${note.text}`
    case 'answered':
      return `answered:\n${note.text}`
    case 'asked':
      return `asked "${note.question}" → ${askedDetail(note) || 'dismissed'}`
    case 'ran':
      return `${note.action} ${note.input} → ${note.answer}`
  }
}
