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

  /**
   * Null until the field is touched, so a setting still on its way from the main process shows
   * up when it lands — seeding the state once would display an empty field over a stored path,
   * and blurring it would erase that path.
   *
   * Committed on blur rather than per keystroke: a controlled input fed by a settings write
   * hands back a stale value mid-word.
   */
  const [typed, setTyped] = useState<string | null>(null)
  const shown = typed ?? stored ?? ''

  // This window connects nothing, so the answer is asked for here — and again once changed.
  useEffect(() => {
    void refreshCapabilities()
  }, [refreshCapabilities])

  const commit = async (): Promise<void> => {
    if (typed === null) return

    const path = typed.trim()
    if (path === (stored ?? '')) return

    // Empty means "the bundled one, or the PATH" — the key is dropped, not stored blank.
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
          value={shown}
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
