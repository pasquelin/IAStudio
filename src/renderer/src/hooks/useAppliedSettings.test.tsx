import { renderHook, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { LanguagePreference } from '@shared/i18n/languages'
import { useSettings } from '@/stores/settings'
import { useAppliedSettings } from './useAppliedSettings'

function withLanguage(language: LanguagePreference) {
  useSettings.setState({
    settings: { ...DEFAULT_SETTINGS, general: { ...DEFAULT_SETTINGS.general, language } },
  })
  return renderHook(() => useAppliedSettings())
}

afterEach(async () => {
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  await i18next.changeLanguage('fr')
})

describe('applying the language', () => {
  it('follows the setting rather than the machine', async () => {
    withLanguage('en')

    await waitFor(() => expect(i18next.language).toBe('en'))
  })

  // `navigator.language` is pinned to French by the test setup, standing in for the machine.
  it('defers to the machine when the setting says system', async () => {
    withLanguage('en')
    await waitFor(() => expect(i18next.language).toBe('en'))

    withLanguage('system')

    await waitFor(() => expect(i18next.language).toBe('fr'))
  })
})
