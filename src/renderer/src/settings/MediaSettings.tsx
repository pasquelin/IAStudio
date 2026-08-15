import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useMedia } from '@/stores/media'
import { useSettings } from '@/stores/settings'
import { cn } from '@/helpers/cn'
import { WINDOW_CAPTION } from '@/design/window-styles'

/**
 * What no descriptor can express: whether a binary actually answers. The path itself is a
 * registry setting like any other — this only reports what came of it.
 */
export function MediaSettings() {
  const { t } = useTranslation()
  const ffmpegPath = useSettings(state => state.settings.media.ffmpegPath)
  const resolved = useMedia(state => state.capabilities.ffmpeg)
  const refreshCapabilities = useMedia(state => state.refreshCapabilities)

  // Asked again whenever the path changes: this window connects nothing, and the answer is
  // exactly what that field decides.
  useEffect(() => {
    void refreshCapabilities()
  }, [refreshCapabilities, ffmpegPath])

  return (
    <p className={cn(WINDOW_CAPTION, 'mt-3')}>
      {resolved ? t('settings.ffmpegFound') : t('settings.ffmpegMissing')}
    </p>
  )
}
