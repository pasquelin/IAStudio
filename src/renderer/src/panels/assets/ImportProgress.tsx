import { useTranslation } from 'react-i18next'
import { assetsById, useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'
import { ImportProgressRow } from './ImportProgressRow'

/**
 * What the ingest of the files just imported is doing. It sits above the browser rather than
 * in the jobs bar: these are not generations, and the row they describe is right below.
 */
export function ImportProgress() {
  const { t } = useTranslation()
  const progress = useMedia(state => state.progress)
  const ffmpeg = useMedia(state => state.capabilities.ffmpeg)
  const byId = useAssets(assetsById)

  const entries = Object.values(progress)

  // The notice outlives the ingests: without ffmpeg one lasts a few hundred milliseconds, and
  // the explanation would vanish just as the user wonders where the waveform went.
  if (ffmpeg && entries.length === 0) return null

  return (
    <div className="border-border border-b">
      {!ffmpeg && <p className="text-muted px-2 py-1 text-[11px]">{t('ingest.noFfmpeg')}</p>}
      <ul>
        {entries.map(entry => (
          <ImportProgressRow
            key={entry.assetId}
            entry={entry}
            name={byId.get(entry.assetId)?.name ?? entry.assetId}
          />
        ))}
      </ul>
    </div>
  )
}
