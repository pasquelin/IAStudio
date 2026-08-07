import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { IngestProgress } from '@shared/domain/media'
import { ProgressRow } from '@/design/ProgressRow'
import { useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'

// Memoised because `apply` keeps the identity of every entry it does not touch: one stage
// change then re-renders one row instead of all of them, per file, per stage.
const Row = memo(function Row({ entry, name }: { entry: IngestProgress; name: string }) {
  const { t } = useTranslation()
  const cancel = useMedia(state => state.cancel)
  const failed = entry.stage === 'failed'

  return (
    <ProgressRow
      label={name}
      ratio={failed ? undefined : entry.ratio}
      status={t(`ingest.${entry.stage}`)}
      statusClassName={failed ? 'text-danger' : 'text-muted'}
      cancelLabel={failed ? undefined : t('ingest.cancel')}
      onCancel={failed ? undefined : () => void cancel(entry.assetId)}
    />
  )
})

/**
 * What the ingest of the files just imported is doing. It sits above the browser rather than
 * in the jobs bar: these are not generations, and the row they describe is right below.
 */
export function ImportProgress() {
  const { t } = useTranslation()
  const progress = useMedia(state => state.progress)
  const ffmpeg = useMedia(state => state.capabilities.ffmpeg)
  const items = useAssets(state => state.items)
  const entries = Object.values(progress)

  // One pass over the catalogue for the whole list, rather than a scan per row on every store
  // change — the browser holds the entire project.
  const names = useMemo(() => new Map(items.map(item => [item.id, item.name])), [items])

  // The notice outlives the ingests: without ffmpeg one lasts a few hundred milliseconds, and
  // the explanation would vanish just as the user wonders where the waveform went.
  if (ffmpeg && entries.length === 0) return null

  return (
    <div className="border-border border-b">
      {!ffmpeg && <p className="text-muted px-2 py-1 text-[11px]">{t('ingest.noFfmpeg')}</p>}
      <ul>
        {entries.map(entry => (
          <Row key={entry.assetId} entry={entry} name={names.get(entry.assetId) ?? entry.assetId} />
        ))}
      </ul>
    </div>
  )
}
