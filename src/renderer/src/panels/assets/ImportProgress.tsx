import { assetsById, useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'
import { ImportProgressRow } from './ImportProgressRow'

/**
 * What the ingest of the files just imported is doing. It sits above the browser rather than
 * in the jobs bar: these are not generations, and the row they describe is right below.
 * Only the ingests: the notice for a missing ffmpeg outlives them, so it rides on the title row
 * rather than hold a row's height here for a whole session.
 */
export function ImportProgress() {
  const progress = useMedia(state => state.progress)
  const byId = useAssets(assetsById)

  const entries = Object.values(progress)

  if (entries.length === 0) return null

  return (
    <div className="border-border shrink-0 border-b">
      {/* A row opens before the pool gate (`main/media/service.ts:138`), so a folder dropped
          whole opens all of them at once and pushes the browser out of the panel. */}
      <ul className="max-h-40 overflow-y-auto">
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
