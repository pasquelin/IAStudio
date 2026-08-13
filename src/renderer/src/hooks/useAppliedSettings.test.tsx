import { renderHook, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import type { Language } from '@shared/i18n/languages'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAppliedSettings } from './useAppliedSettings'

afterEach(async () => {
  await i18next.changeLanguage('fr')
})

describe('applying the language', () => {
  it('takes the language the main process pushes', async () => {
    let push: ((language: Language) => void) | undefined
    installFakeBridge({
      window: {
        onLanguage: callback => {
          push = callback
          return () => {}
        },
      },
    })

    renderHook(() => useAppliedSettings())
    push?.('en')

    await waitFor(() => expect(i18next.language).toBe('en'))
  })

  /**
   * `main.tsx` reads the language before React mounts, so a change landing between that read
   * and this subscription would reach no listener and stay wrong for the whole session.
   */
  it('reads it again on mount, in case one changed while nobody was listening', async () => {
    installFakeBridge({ window: { language: (): Promise<Language> => Promise.resolve('en') } })

    renderHook(() => useAppliedSettings())

    await waitFor(() => expect(i18next.language).toBe('en'))
  })
})
