import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useMedia } from '@/stores/media'
import { useSettings } from '@/stores/settings'

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
    <p className="text-base-content/60 mt-3 text-xs">
      {resolved ? t('settings.ffmpegFound') : t('settings.ffmpegMissing')}
    </p>
  )
}
