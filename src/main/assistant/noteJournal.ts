import type { ActivityReport } from '@main/project/activityLog'
import type { AssistantNote } from '@shared/domain/assistantNote'

/**
 * One note as the journal keeps it.
 *
 * 🛑 A prompt keeps NO detail, and that is the whole shape of this table: `chainOn` runs up to
 * forty rounds, each writing a `sent` and an `answered`, against a journal of 2 000 lines that
 * also holds what a person cannot afford to read later. Its SIZE is the finding; its text is the
 * same catalogue every round, and `detail` carries `describeFailure` output by contract — a raw
 * briefing there would widen a rule about what a file someone may send us is allowed to hold.
 */
export function reportOfNote(note: AssistantNote): ActivityReport {
  return { topic: 'assistant', level: 'info', ...saidOf(note) }
}

type Said = Omit<ActivityReport, 'topic' | 'level'> & { level?: ActivityReport['level'] }

function saidOf(note: AssistantNote): Said {
  switch (note.kind) {
    case 'sent':
      return {
        messageKey: 'activity.assistantSent',
        params: { door: note.door, chars: note.chars },
      }
    case 'answered':
      return {
        messageKey: 'activity.assistantAnswered',
        params: { chars: note.chars },
        detail: note.text,
      }
    case 'asked':
      // The dismissal is the answer that ends a turn, so it is said rather than left blank.
      return {
        messageKey: 'activity.assistantAsked',
        params: { question: note.question },
        detail: note.answer ?? '',
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

/** The same note as the log keeps it, which is where the prompt itself goes. */
export function lineOfNote(note: AssistantNote): string {
  switch (note.kind) {
    case 'sent':
      return `sent to ${note.door}:\n${note.text}`
    case 'answered':
      return `answered:\n${note.text}`
    case 'asked':
      return `asked "${note.question}" → ${note.answer ?? 'dismissed'}`
    case 'ran':
      return `${note.action} ${note.input} → ${note.answer}`
  }
}
