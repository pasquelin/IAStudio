import { mdiDownloadOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ProgressBar } from '@/design/ProgressBar'
import { UiIcon } from '@/design/UiIcon'
import { useUpdates } from '@/stores/updates'

export function UpdateStatus() {
  const { t } = useTranslation()
  const update = useUpdates(state => state.update)
  const install = useUpdates(state => state.install)

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

  // `idle`, `checking` and `failed` all render as nothing — see `UpdateState`.
  if (update.phase !== 'ready') return null

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
