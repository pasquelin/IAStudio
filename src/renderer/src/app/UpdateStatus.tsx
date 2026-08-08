import { mdiDownloadOutline } from '@mdi/js'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ProgressBar } from '@/design/ProgressBar'
import { UiIcon } from '@/design/UiIcon'
import { useUpdates } from '@/stores/updates'

/**
 * A new version, in the status line beside the generations.
 *
 * Deliberately quiet: no dialog, no banner, no restart forced on anyone. The update is applied
 * on the next quit whatever happens here — this only offers to make that moment now.
 */
export function UpdateStatus() {
  const { t } = useTranslation()
  const update = useUpdates(state => state.update)
  const connect = useUpdates(state => state.connect)
  const install = useUpdates(state => state.install)

  useEffect(() => {
    const stopping = connect()
    return () => {
      void stopping.then(stop => stop())
    }
  }, [connect])

  // Silent while nothing is happening, and silent on failure too: not knowing whether a newer
  // version exists is not a problem the user has to be told about.
  if (update.phase === 'idle' || update.phase === 'checking' || update.phase === 'failed') {
    return null
  }

  if (update.phase === 'available') {
    return <span>{t('updates.available', { version: update.version })}</span>
  }

  if (update.phase === 'downloading') {
    const label = t('updates.downloading', { version: update.version })
    return (
      <span className="flex items-center gap-1.5">
        <span>{label}</span>
        <ProgressBar ratio={update.progress} label={label} className="w-12" />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      className="hover:text-text flex items-center gap-1.5"
    >
      <UiIcon path={mdiDownloadOutline} size={12} />
      <span>{t('updates.restart', { version: update.version })}</span>
    </button>
  )
}
