import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { hasFailed, type IngestProgress } from '@shared/domain/media'
import { ProgressRow } from '@/components/ProgressRow'
import { useMedia } from '@/stores/media'

export type ImportProgressRowProps = {
  entry: IngestProgress
  /** The asset's name, resolved by the list: a row must not scan the catalogue for its own. */
  name: string
}

/**
 * One file being ingested. Memoized because `apply` keeps the identity of every entry it does
 * not touch: one stage change then re-renders one row instead of all of them.
 */
export const ImportProgressRow = memo(function ImportProgressRow({
  entry,
  name,
}: ImportProgressRowProps) {
  const { t } = useTranslation()
  const cancel = useMedia(state => state.cancel)
  const failed = hasFailed(entry.stage)

  return (
    <ProgressRow
      label={name}
      ratio={failed ? undefined : entry.ratio}
      status={t(`ingest.${entry.stage}`)}
      tone={failed ? 'danger' : 'muted'}
      // A failure has nothing left to stop, but it still has to be dismissable: nothing else
      // ever clears it, and there is no retry — re-picking the file makes another row.
      cancel={{
        label: failed ? t('ingest.dismiss') : t('ingest.cancel'),
        onClick: () => void cancel(entry.assetId),
      }}
    />
  )
})
