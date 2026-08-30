import { describe, expect, it } from 'vitest'
import { isToastWorthy } from '@shared/domain/activity'
import { isRecord } from '@shared/guards'
import { LANGUAGES, TRANSLATIONS } from '@shared/i18n'
import type { AssistantNote } from '@shared/domain/assistantNote'
import { lineOfNote, reportOfNote } from './noteJournal'

/** Every note the union can carry, so the guard below reads them all rather than a sample. */
const EVERY_NOTE: readonly AssistantNote[] = [
  { kind: 'sent', door: 'deepseek — deepseek-chat', chars: 90_298, text: 'You drive' },
  { kind: 'answered', chars: 21, text: '{"say":"","calls":[]}' },
  { kind: 'ran', action: 'jobs.list', input: '{}', answer: 'ok', refused: false },
  { kind: 'ran', action: 'project.create', input: '{}', answer: 'badInput', refused: true },
  { kind: 'asked', question: 'Quel nom ?', answer: 'Bateaux' },
]

const CODES = LANGUAGES.map(one => one.code)

/** The sentence a key resolves to, walked rather than indexed: half these names are plural stems. */
function sentenceOf(bundle: unknown, key: string): string {
  const found = key
    .split('.')
    .reduce<unknown>((at, part) => (isRecord(at) ? at[part] : undefined), bundle)
  return typeof found === 'string' ? found : ''
}

describe('what a note becomes in the journal', () => {
  /**
   * 🛑 A hole nothing fills draws EMPTY on screen, and nothing else here would say so: these keys
   * are composed at runtime, so `known-keys.i18n.test.ts` never resolves them — it was written
   * with `{{round}}` and `{{model}}` where the code passes `door` and `chars`, and every gate
   * was green on a line that would have read « Tour  envoyé à  ».
   */
  it.each(CODES)('fills every hole of its %s sentence', code => {
    const unfilled = EVERY_NOTE.flatMap(note => {
      const report = reportOfNote(note)
      const sentence = sentenceOf(TRANSLATIONS[code], report.messageKey)
      return [...sentence.matchAll(/{{\s*(\w+)/g)]
        .map(hole => hole[1] ?? '')
        .filter(name => report.params?.[name] === undefined)
        .map(name => `${report.messageKey} — ${name}`)
    })

    expect(unfilled).toEqual([])
  })

  /**
   * 🛑 A prompt keeps NO detail: `chainOn` runs up to forty rounds, each writing a `sent`, against
   * a journal of 2 000 lines that also holds what a person cannot afford to read later. Its SIZE
   * is the finding — the text is the same catalogue every round.
   */
  it('keeps a prompt out of the database, and says how big it was', () => {
    const report = reportOfNote({ kind: 'sent', door: 'deepseek', chars: 90_298, text: 'You' })

    expect(report.detail).toBeUndefined()
    expect(report.params?.['chars']).toBe(90_298)
  })

  /**
   * 🛑 `warn` and never `error`: a refusal is the studio holding its own line, and `isToastWorthy`
   * turns an error into a toast — every refused call of a plan would raise one.
   */
  it('reports a refusal without putting a toast on the screen', () => {
    const report = reportOfNote({
      kind: 'ran',
      action: 'project.create',
      input: '{}',
      answer: 'badInput',
      refused: true,
    })

    expect(report.level).toBe('warn')
    expect(isToastWorthy({ ...report, at: '' })).toBe(false)
  })

  it('says what the person answered, and that they answered nothing', () => {
    const answered: AssistantNote = { kind: 'asked', question: 'Quel nom ?', answer: 'Bateaux' }
    const dismissed: AssistantNote = { kind: 'asked', question: 'Quel nom ?', answer: null }

    expect(reportOfNote(answered).detail).toBe('Bateaux')
    expect(lineOfNote(dismissed)).toContain('dismissed')
  })
})
