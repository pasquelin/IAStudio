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
