import { describe, expect, it } from 'vitest'
import i18next from 'i18next'
import { initI18n } from './index'

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
