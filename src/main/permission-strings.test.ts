import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Under `src/main` for the same reason as `licences.test.ts`: `src/shared` compiles for the
// renderer, where `node:fs` has no types.
const ROOT = join(import.meta.dirname, '..', '..')

const LPROJ = join(ROOT, 'build', 'lproj')
const KEY = 'NSMicrophoneUsageDescription'

/** What a `.strings` file says for one key — the format is `"KEY" = "value";`, comments aside. */
function stringsValue(locale: string): string {
  const file = readFileSync(join(LPROJ, `${locale}.lproj`, 'InfoPlist.strings'), 'utf8')
  const match = file.match(new RegExp(`"${KEY}"\\s*=\\s*"([^"]*)"\\s*;`))
  if (!match?.[1]) throw new Error(`${locale}.lproj declares no ${KEY}`)
  return match[1]
}

/**
 * The sentence macOS shows in its own permission dialog, which no bundle can reach: the system
 * draws it before the window exists. It lives in `mac.extendInfo` and, since it is localised, in
 * one `InfoPlist.strings` per language.
 *
 * `extendInfo` stays the English one because it is the fallback for every language with no
 * `.lproj` of its own. Two wordings for the same sentence is what this guards against: change one
 * and the other keeps serving the old text to whoever falls back to it.
 */
describe('the microphone permission sentence', () => {
  const packaging = readFileSync(join(ROOT, 'electron-builder.yml'), 'utf8')

  it('says the same thing in the plist and in the English strings file', () => {
    // The YAML folds the value over two lines; the join has to match how a YAML reader reads it.
    const folded = packaging.match(/NSMicrophoneUsageDescription:\n((?: {6}.+\n)+)/)?.[1]
    const written = folded
      ?.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join(' ')

    expect(written).toBe(stringsValue('en'))
  })

  it('says it in French too, and not by leaving it in English', () => {
    expect(stringsValue('fr')).not.toBe(stringsValue('en'))
    expect(stringsValue('fr')).toMatch(/microphone/)
  })

  // The files reach the bundle through `mac.extraResources`, never the root one: an `.lproj`
  // folder means nothing to Windows or Linux, and shipping it there is dead weight in every
  // installer.
  it('ships them from the macOS section alone', () => {
    const macSection = packaging.slice(packaging.indexOf('\nmac:'))

    expect(macSection).toMatch(/^ {4}- from: build\/lproj$/m)
  })
})
