import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { shortcutLabel, type Signature } from '@shared/domain/shortcut'
import { IS_MAC } from '@/helpers/platform'

/**
 * `shortcutLabel` with the studio's language behind it. A hook rather than a call at each site:
 * the label feeds `useMemo` dependency lists, and a fresh closure per render would rebuild the
 * toolbars of every space on every keystroke.
 */
export function useShortcutLabel(): (signature: Signature | null) => string {
  const { t } = useTranslation()

  return useCallback(signature => shortcutLabel(signature, code => t(`keys.${code}`), IS_MAC), [t])
}
