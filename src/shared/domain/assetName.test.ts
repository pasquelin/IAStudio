import { describe, expect, it } from 'vitest'
import { ASSET_NAME_MAX_LENGTH } from './asset'
import { assetFileName, checkAssetName, generatedAssetName } from './assetName'

describe('whether an asset may be called this', () => {
  it('accepts an ordinary name and refuses one nobody typed', () => {
    expect(checkAssetName('Pas courus')).toBeNull()
    expect(checkAssetName('   ')).toBe('empty')
  })

  it('refuses a name longer than a file name may be', () => {
    expect(checkAssetName('a'.repeat(ASSET_NAME_MAX_LENGTH))).toBeNull()
    expect(checkAssetName('a'.repeat(ASSET_NAME_MAX_LENGTH + 1))).toBe('too-long')
  })

  /** Counted by code point, as the bound is meant: a name of emoji is as long as it looks. */
  it('measures a name in characters, not in the units a string is stored in', () => {
    expect(checkAssetName('🎬'.repeat(40))).toBeNull()
  })

  /**
   * Eighty code points of emoji are 320 bytes and ext4 stops at 255, so the name is refused — and
   * refused for its LENGTH. Without the byte check it fell to `isSafeFileName` and came back
   * `invalid`, which tells the user their name is malformed when it is merely too long.
   */
  it('says a name too long in bytes is too long, not malformed', () => {
    expect(checkAssetName('🎬'.repeat(ASSET_NAME_MAX_LENGTH))).toBe('too-long')
  })

  /**
   * The whole of this change: the name reached the file, so what a file system refuses, an
   * asset refuses. Refused rather than quietly cleaned — a name the studio would rewrite is a
   * second name for the asset, and one name is the point.
   */
  it('refuses what a file name cannot hold, rather than cleaning it behind the user', () => {
    expect(checkAssetName('Vue 3/4')).toBe('invalid')
    expect(checkAssetName('Ruelle.')).toBe('invalid')
    expect(checkAssetName('  Ruelle bleue  ')).toBeNull()
  })
})

describe('the file an asset lands on', () => {
  it('is its name, and the extension its bytes came with', () => {
    expect(assetFileName('Ruelle bleue', '.png')).toBe('Ruelle bleue.png')
  })

  /**
   * Nothing here is typed by a user: a generated name is the PROMPT, and a prompt holding a
   * slash is an ordinary prompt and a path traversal at the same time.
   */
  it('holds a generated name to the same rule, having nobody to refuse it to', () => {
    expect(assetFileName('Vue 3/4 de la ruelle', '.png')).toBe('Vue 3 4 de la ruelle.png')
    expect(assetFileName('../../.ssh/id_rsa', '.png')).toBe('ssh id_rsa.png')
    expect(assetFileName('   ', '.png')).toBe('asset.png')
  })
})

/**
 * The prompt, not the model. A shelf named after models is a shelf where everything of one
 * model reads the same — which is what « ElevenLabs Sound Effects 2 » beside a tab saying the
 * same thing was.
 */
describe('what the studio calls a generation', () => {
  const label = 'ElevenLabs Sound Effects'

  it('names it after what was asked for', () => {
    const name = generatedAssetName({
      prompt: 'Background footsteps and rustling sounds',
      label,
      index: 0,
      total: 1,
    })

    expect(name).toBe('Background footsteps and rustling sounds')
  })

  it('falls back on the model where there was no prompt to go on', () => {
    expect(generatedAssetName({ label, index: 0, total: 1 })).toBe(label)
    expect(generatedAssetName({ prompt: '   ', label, index: 0, total: 1 })).toBe(label)
  })

  // A prompt is typed over several lines as often as not.
  it('reads a prompt written over several lines as one line', () => {
    const name = generatedAssetName({
      prompt: 'Footsteps,\n  then  rain',
      label,
      index: 0,
      total: 1,
    })

    expect(name).toBe('Footsteps, then rain')
  })

  /** Cut mid-word reads as a typo rather than as an abbreviation. */
  it('cuts a long prompt on a word, and says that it cut', () => {
    const name = generatedAssetName({
      prompt: 'A very long description of a sound that goes on well past what a caption can hold',
      label,
      index: 0,
      total: 1,
    })

    expect(name).toBe('A very long description of a sound that goes on well past…')
    expect(name).not.toContain('  ')
  })

  it('leaves a prompt that fits without an ellipsis', () => {
    expect(generatedAssetName({ prompt: 'Rain', label, index: 0, total: 1 })).toBe('Rain')
  })

  /** `slice` counts UTF-16 units: a prompt of emoji came out ending on half a surrogate pair. */
  it('cuts between characters rather than through one', () => {
    const name = generatedAssetName({ prompt: '🎬'.repeat(100), label, index: 0, total: 1 })

    expect(name.endsWith('🎬…')).toBe(true)
  })

  // One output of one job is the thing itself, not the first of a series.
  it('numbers the outputs only when a job returned several', () => {
    expect(generatedAssetName({ prompt: 'Rain', label, index: 0, total: 1 })).toBe('Rain')
    expect(generatedAssetName({ prompt: 'Rain', label, index: 0, total: 4 })).toBe('Rain 1')
    expect(generatedAssetName({ prompt: 'Rain', label, index: 3, total: 4 })).toBe('Rain 4')
  })
})
