import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMedia } from '@/stores/media'
import { useSettings } from '@/stores/settings'

export function MediaSettings() {
  const { t } = useTranslation()
  const stored = useSettings(state => state.settings.media.ffmpegPath)
  const write = useSettings(state => state.write)
  const resolved = useMedia(state => state.capabilities.ffmpeg)
  const refreshCapabilities = useMedia(state => state.refreshCapabilities)

  // Typed locally and committed on blur. A controlled input fed by a settings write would hand
  // back a stale value mid-word, and every keystroke would persist a path that resolves to
  // nothing anyway.
  const [typed, setTyped] = useState(stored ?? '')

  // The settings window is a renderer of its own and connects nothing, so the answer has to be
  // asked for here — and asked again after the field below changed it.
  useEffect(() => {
    void refreshCapabilities()
  }, [refreshCapabilities])

  const commit = async (): Promise<void> => {
    const path = typed.trim()
    if (path === (stored ?? '')) return

    // Empty means "the bundled one, or the PATH", which is the default — the key is dropped
    // rather than storing a path that resolves to nothing.
    await write({ media: { ffmpegPath: path === '' ? undefined : path } })
    await refreshCapabilities()
  }

  return (
    <div className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs">
        {t('settings.ffmpegPath')}
        <input
          className="input input-sm"
          type="text"
          placeholder={t('settings.ffmpegPlaceholder')}
          value={typed}
          onChange={event => setTyped(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={event => {
            if (event.key === 'Enter') void commit()
          }}
        />
      </label>

      <p className="text-muted text-xs">
        {resolved ? t('settings.ffmpegFound') : t('settings.ffmpegMissing')}
      </p>
    </div>
  )
}
