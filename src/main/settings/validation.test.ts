import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { partialFor, type SettingValue } from '@shared/domain/settingsPath'
import {
  optionsOf,
  SETTING_REGISTRY,
  type SettingDescriptor,
} from '@shared/domain/settingsRegistry'
import { parsePartialSettings, salvagePartialSettings } from './validation'

/** A value the descriptor itself says is acceptable — no second table of examples to maintain. */
function acceptable(descriptor: SettingDescriptor): SettingValue {
  switch (descriptor.kind) {
    case 'boolean':
      return true
    case 'choice':
      return optionsOf(descriptor)[0]?.value ?? ''
    case 'color':
      return '#3574f0'
    case 'number':
    case 'slider':
      return descriptor.min ?? 1
    default:
      return '/some/path'
  }
}

describe('settings validation', () => {
  /*
   * The shape is enumerated by hand in `validation.ts`, and zod STRIPS what it does not declare
   * rather than refusing it. A branch added to `Settings` and forgotten there would therefore
   * seem to save and be gone on the next launch — the worst of the two failures, because
   * nothing reports it. Driven from the registry so this needs no upkeep of its own.
   */
  it('keeps every setting the registry describes, so none is silently stripped on write', () => {
    for (const descriptor of SETTING_REGISTRY) {
      const written = partialFor(descriptor.path, acceptable(descriptor))
      expect(parsePartialSettings(written), `${descriptor.path} is stripped on write`).toEqual(
        written,
      )
    }
  })

  it('keeps every branch of the defaults, which is what a fresh install writes back', () => {
    expect(parsePartialSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS)
  })

  it('accepts a partial and keeps only the sections it declares', () => {
    expect(parsePartialSettings({ appearance: { density: 'compact' } })).toEqual({
      appearance: { density: 'compact' },
    })
  })

  it('drops keys the contract does not declare', () => {
    expect(parsePartialSettings({ appearance: { density: 'compact', zoom: 3 } })).toEqual({
      appearance: { density: 'compact' },
    })
  })

  it('rejects a value outside the declared union', () => {
    expect(() => parsePartialSettings({ appearance: { theme: 'purple' } })).toThrow()
  })

  it('rejects a job concurrency the semaphore could not honour', () => {
    expect(() => parsePartialSettings({ generation: { concurrentJobs: 0 } })).toThrow()
    expect(() => parsePartialSettings({ generation: { concurrentJobs: 999 } })).toThrow()
    expect(() => parsePartialSettings({ generation: { concurrentJobs: 2.5 } })).toThrow()
  })

  /*
   * The shape is `HEX_COLOR`, shared with the document readers rather than restated here. The
   * three-digit case is the one worth naming: CSS honours it, `tokenAsHex` reads `#fff` as
   * `0xfff` — a dark blue — and this is the only side of that shared constant zod guards.
   */
  it('rejects an accent that is not six hexadecimal digits', () => {
    expect(parsePartialSettings({ appearance: { accent: '#3574F0' } })).toEqual({
      appearance: { accent: '#3574F0' },
    })
    expect(() => parsePartialSettings({ appearance: { accent: '#fff' } })).toThrow()
    expect(() => parsePartialSettings({ appearance: { accent: 'red' } })).toThrow()
  })

  it('accepts a path to ffmpeg, which it never checks for existence', () => {
    // The binary may be plugged in later; `resolveFfmpeg` falls through to the PATH meanwhile.
    expect(parsePartialSettings({ media: { ffmpegPath: '/nowhere/yet/ffmpeg' } })).toEqual({
      media: { ffmpegPath: '/nowhere/yet/ffmpeg' },
    })
  })

  it('rejects an ffmpeg path that is not a usable string', () => {
    expect(() => parsePartialSettings({ media: { ffmpegPath: '' } })).toThrow()
    expect(() => parsePartialSettings({ media: { ffmpegPath: 42 } })).toThrow()
  })

  it('rejects anything that is not an object', () => {
    expect(() => parsePartialSettings('compact')).toThrow()
    expect(() => parsePartialSettings(null)).toThrow()
  })

  it('salvages a hand-edited config file into the defaults instead of throwing', () => {
    expect(salvagePartialSettings({ appearance: { theme: 'purple' } })).toEqual({})
    expect(salvagePartialSettings('garbage')).toEqual({})
    expect(salvagePartialSettings(undefined)).toEqual({})
  })

  it('salvages a valid stored partial unchanged', () => {
    expect(salvagePartialSettings({ storage: { backend: 'cloud' } })).toEqual({
      storage: { backend: 'cloud' },
    })
  })
})

/**
 * The bar order is the one branch a stale or hand-edited file is likely to carry wrong, since
 * it is written by a gesture rather than typed into a screen. Before it existed, an unknown key
 * was simply stripped — it must not become the key that costs the file.
 */
describe('salvaging the bar order', () => {
  const withTheme = (workspaces: unknown): unknown => ({
    workspaces,
    appearance: { theme: 'light' },
  })

  it('drops a space this build no longer knows, keeping the rest of the order', () => {
    const salvaged = salvagePartialSettings(withTheme({ order: ['image', 'nether', 'audio'] }))

    expect(salvaged.workspaces?.order).toEqual(['image', 'audio'])
    expect(salvaged.appearance?.theme).toBe('light')
  })

  it('keeps the other settings when the order is not a list at all', () => {
    expect(salvagePartialSettings(withTheme({ order: 'image' })).appearance?.theme).toBe('light')
  })

  it('keeps the other settings when the branch itself is not an object', () => {
    expect(salvagePartialSettings(withTheme(['image', 'audio'])).appearance?.theme).toBe('light')
  })

  // A written order is always a reconciled one, so it can never legitimately outgrow the
  // registry — a longer list is a file to distrust, not a list to keep in memory and rewrite.
  it('refuses an order longer than the registry, and only the order', () => {
    const long = Array.from({ length: 10_000 }, () => 'image')

    const salvaged = salvagePartialSettings(withTheme({ order: long }))

    expect(salvaged.workspaces?.order ?? []).toEqual([])
    expect(salvaged.appearance?.theme).toBe('light')
  })
})

/**
 * A role choice names a cloud from a registry that can lose an entry between two builds — the
 * `ai` schema advertises exactly that. One such line must cost its own line and nothing else.
 */
describe('salvaging the AI role choices', () => {
  const withTheme = (ai: unknown): unknown => ({ ai, appearance: { theme: 'light' } })

  it('drops a choice naming a cloud this build no longer holds, keeping the rest', () => {
    const salvaged = salvagePartialSettings(
      withTheme({
        roles: {
          assistant: { kind: 'cloud', providerId: 'nowhere' },
          'image/txt2img': { kind: 'local', modelId: 'llama3.2:3b' },
        },
      }),
    )

    expect(salvaged.ai?.roles).toEqual({
      'image/txt2img': { kind: 'local', modelId: 'llama3.2:3b' },
    })
    expect(salvaged.appearance?.theme).toBe('light')
  })

  // The whole file goes through one `safeParse`: without the per-entry catch, this line took the
  // theme, the projects folder and every binding down with it.
  it('keeps the other settings when a choice is not a provider at all', () => {
    const salvaged = salvagePartialSettings(withTheme({ roles: { assistant: 'llama' } }))

    expect(salvaged.ai?.roles).toEqual({})
    expect(salvaged.appearance?.theme).toBe('light')
  })

  it('keeps the other settings when a project override is unreadable', () => {
    const salvaged = salvagePartialSettings(
      withTheme({ projectRoles: { '/a/project': { assistant: { kind: 'nether' } } } }),
    )

    expect(salvaged.ai?.projectRoles).toEqual({ '/a/project': {} })
    expect(salvaged.appearance?.theme).toBe('light')
  })
})

/** The home's band order is written by the same kind of gesture, and costs the same if refused. */
describe('salvaging the home section order', () => {
  const withTheme = (home: unknown): unknown => ({ home, appearance: { theme: 'light' } })

  it('drops a section this build no longer knows, keeping the rest of the order', () => {
    const sections = [
      { id: 'spotlight', visible: true },
      { id: 'nether' },
      // A band of an older build that IS one again: `tools` came back to the centre on 12 August,
      // so its entry is salvaged where `projects` — still a panel — would be dropped.
      { id: 'tools', visible: true },
      { id: 'projects', visible: true },
      { id: 'explore', visible: false },
    ]

    const salvaged = salvagePartialSettings(withTheme({ sections }))

    expect(salvaged.home?.sections).toEqual([
      { id: 'spotlight', visible: true },
      { id: 'tools', visible: true },
      { id: 'explore', visible: false },
    ])
  })

  it('keeps the other settings when the sections are not a list at all', () => {
    const salvaged = salvagePartialSettings(withTheme({ enabled: false, sections: 'spotlight' }))

    expect(salvaged.home?.sections ?? []).toEqual([])
    expect(salvaged.appearance?.theme).toBe('light')
  })

  it('keeps the other settings when the branch itself is not an object', () => {
    expect(salvagePartialSettings(withTheme(['tools'])).appearance?.theme).toBe('light')
  })
})

/**
 * A remap crosses as a plain string, so the shape is all there is to check. The cost of getting
 * it wrong is not symmetrical: a refused binding is a key nobody can bind, while an accepted one
 * no keyboard emits is only a shortcut that never fires.
 */
describe('the keys a settings file remaps', () => {
  it('keeps a binding on any key a real keyboard emits', () => {
    const overrides = {
      'canvas.toolBrush': 'IntlBackslash',
      'canvas.toolPencil': 'Meta+ContextMenu',
      'canvas.undo': 'Ctrl+Alt+Shift+Meta+KeyZ',
    }

    expect(salvagePartialSettings({ shortcuts: { overrides } }).shortcuts?.overrides).toEqual(
      overrides,
    )
  })

  /**
   * The defect the guard exists for: a letter is what is printed on a key, never its position.
   */
  it('drops a binding written as a letter rather than a code', () => {
    const file = { shortcuts: { overrides: { 'canvas.toolBrush': 'P' } } }

    expect(salvagePartialSettings(file).shortcuts?.overrides).toEqual({})
  })

  /**
   * One unreadable remap costs its own line and nothing else. Refusing the whole file would take
   * the theme and the projects folder down with a key bound under an older version — which is
   * what `home.sections` already learnt.
   */
  it('keeps every other setting, and every other binding, around the one it drops', () => {
    const file = {
      appearance: { theme: 'dark' },
      shortcuts: { overrides: { 'canvas.toolBrush': 'P', 'canvas.toolPencil': 'Shift+KeyP' } },
    }

    const salvaged = salvagePartialSettings(file)

    expect(salvaged.appearance?.theme).toBe('dark')
    expect(salvaged.shortcuts?.overrides).toEqual({ 'canvas.toolPencil': 'Shift+KeyP' })
  })

  /**
   * The write side drops it too rather than refusing the draft. `settingsDraft` clears what is
   * pending before the write settles, so a throw here would take the theme staged in the same
   * Apply with it — and say nothing about either.
   */
  it('drops it on the way in as well, keeping the rest of the draft', () => {
    const written = parsePartialSettings({
      appearance: { theme: 'dark' },
      shortcuts: { overrides: { 'canvas.toolBrush': 'P', 'canvas.undo': 'Meta+KeyZ' } },
    })

    expect(written.appearance?.theme).toBe('dark')
    expect(written.shortcuts?.overrides).toEqual({ 'canvas.undo': 'Meta+KeyZ' })
  })
})

/**
 * A zod object STRIPS what it does not name, and this branch is reparsed on every settings write
 * — which the project store does on every document saved. A field declared on the type but not on
 * the schema therefore survives exactly until the next save, and nothing anywhere says why.
 */
describe('the account each project works under', () => {
  it('keeps the links', () => {
    const parsed = parsePartialSettings({
      storage: { projectAccounts: { '/projects/a': 'account_two' } },
    })

    expect(parsed.storage?.projectAccounts).toEqual({ '/projects/a': 'account_two' })
  })

  it('refuses an empty account id rather than storing a link to nothing', () => {
    expect(() =>
      parsePartialSettings({ storage: { projectAccounts: { '/projects/a': '' } } }),
    ).toThrow()
  })
})
