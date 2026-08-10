import { afterEach, describe, expect, it, vi } from 'vitest'
import i18next from 'i18next'
import { initI18n, PSEUDO_LOCALE_FLAG } from './index'

describe('initI18n', () => {
  it('declares on the document what the interface is written in', async () => {
    await initI18n('en')

    expect(document.documentElement.lang).toBe('en')
    expect(i18next.language).toBe('en')
  })

  // Idempotent by design — the settings call it again on every language change.
  it('moves the declaration with the language', async () => {
    await initI18n('en')
    await initI18n('fr')

    expect(document.documentElement.lang).toBe('fr')
  })
})

/**
 * A thousand is not written the same on both sides of the Channel, and a count is text like any
 * other. The studio already formats the figures of the usage window through `Intl`; the counts
 * written inside a sentence went out raw, so a library of four thousand assets read `4000`.
 */
describe('the numbers a sentence carries', () => {
  it('groups the thousands the French way', async () => {
    await initI18n('fr')

    // U+202F, the narrow no-break space `Intl.NumberFormat` picks for French.
    expect(i18next.t('assets.count', { count: 4000 })).toBe('4 000 assets')
  })

  it('groups them the English way in English', async () => {
    await initI18n('en')

    expect(i18next.t('assets.count', { count: 4000 })).toBe('4,000 assets')
  })

  it('leaves a small count looking exactly as it did', async () => {
    await initI18n('fr')

    expect(i18next.t('assets.count', { count: 3 })).toBe('3 assets')
    expect(i18next.t('assets.count', { count: 1 })).toBe('1 asset')
  })

  // A repeat factor is not a tally: `2×` must never become `2 000×` worth of grouping, and it
  // reads the same in both languages.
  it('leaves the tiling factor alone', async () => {
    await initI18n('fr')

    expect(i18next.t('texture.tilingPreviewTimes', { count: 4 })).toBe('4×')
  })
})

/**
 * Pseudo-localization is the only detector that finds text nobody routed through a bundle:
 * whatever stays unaccented on screen was written in a component. It has to be reachable from
 * a running window, and it has to be unreachable from a shipped one.
 */
describe('the pseudo-locale', () => {
  afterEach(async () => {
    vi.unstubAllEnvs()
    localStorage.removeItem(PSEUDO_LOCALE_FLAG)
    await initI18n('fr')
  })

  it('leaves the interface in its own language while the flag is off', async () => {
    await initI18n('fr')

    expect(i18next.t('assets.count', { count: 3 })).toBe('3 assets')
  })

  it('marks every string once the flag is on', async () => {
    localStorage.setItem(PSEUDO_LOCALE_FLAG, 'on')

    await initI18n('fr')

    expect(i18next.t('assets.count', { count: 3 })).toBe('⟦3 áššétš ··⟧')
  })

  it('overrides the language the settings ask for, so a preference cannot leave it', async () => {
    localStorage.setItem(PSEUDO_LOCALE_FLAG, 'on')

    await initI18n('en')

    expect(i18next.language).toBe('pseudo')
  })

  // `pseudo` is not a language tag: a screen reader handed one it does not know drops to the
  // system voice, and the text underneath is French.
  it('still declares the document written in the source language', async () => {
    localStorage.setItem(PSEUDO_LOCALE_FLAG, 'on')

    await initI18n('en')

    expect(document.documentElement.lang).toBe('fr')
  })

  it('stays out of reach of a production build, flag or no flag', async () => {
    vi.stubEnv('DEV', false)
    localStorage.setItem(PSEUDO_LOCALE_FLAG, 'on')

    await initI18n('fr')

    expect(i18next.t('assets.count', { count: 3 })).toBe('3 assets')
  })
})
