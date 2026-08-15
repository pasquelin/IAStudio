import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveLanguage, translateModelText } from '@shared/i18n'

/**
 * Says a text the model itself wrote — a label, a description, a group heading — in the
 * studio's language.
 *
 * Applied when rendering rather than when the descriptors are built, so switching language
 * re-says the open form instead of waiting for the model to be fetched again.
 */
export function useModelText(): (text: string) => string {
  const { i18n } = useTranslation()
  const language = resolveLanguage(i18n.language)

  return useCallback(text => translateModelText(text, language), [language])
}
