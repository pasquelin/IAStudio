import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LANGUAGES, TRANSLATIONS } from '@shared/i18n'
import { CURRENT } from '@main/logFile'
import { createTranscript, TRANSCRIPT } from './transcript'

describe('the transcript', () => {
  /**
   * 🛑 The one place a briefing survives whole — see `AssistantNote`. The rotation and the refusal
   * to throw on an impossible folder are `createRotatingFile`'s, and its own suite holds them.
   */
  it('keeps the whole of what went out', () => {
    const at = mkdtempSync(join(tmpdir(), 'transcript-'))

    createTranscript(() => at)('y'.repeat(90_505))

    expect(readFileSync(join(at, TRANSCRIPT), 'utf8')).toContain('y'.repeat(90_505))
  })
})

describe('what names the two files a reader is sent to', () => {
  /**
   * 🛑 The help of `advanced.openLogFolder` names both files by hand, and nothing tied it to what
   * they are actually called: renaming one leaves the sentence pointing at a file that is not
   * there, in both languages, with every gate green.
   */
  it.each(LANGUAGES.map(one => one.code))('names main.log and assistant.log in %s', code => {
    const help = TRANSLATIONS[code].settings.openLogFolder.help

    expect(help).toContain(CURRENT)
    expect(help).toContain(TRANSCRIPT)
  })
})
