import { mdiImageSearchOutline } from '@mdi/js'
import { useMemo } from 'react'
import { posterUrl, type AssetType } from '@shared/domain/asset'
import { Button } from '@/design/Button'
import { EmptyState } from '@/design/EmptyState'
import { MediaTile } from '@/design/MediaTile'
import { FIELD } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { isComposing } from '@/helpers/composition'
import { useProjectPictureAssets } from '@/hooks/useProjectPictureAssets'

export type AssetPickerBodyProps = {
  accepts: readonly AssetType[]
  search: string
  onSearch: (search: string) => void
  titleId: string
  /** `null` calls the choice off. */
  settle: (assetId: string | null) => void
  labels: Record<'title' | 'search' | 'empty' | 'cancel', string>
}

/**
 * The window itself, split from the shell that registers it so the catalogue is asked ONLY while
 * it is up: hooks cannot be called conditionally, and a picker mounted for the session would hold
 * a query open for as long as the studio runs.
 */
export function AssetPickerBody({
  accepts,
  search,
  onSearch,
  titleId,
  settle,
  labels,
}: AssetPickerBodyProps) {
  /**
   * The project's own pictures, as the slot's list holds them.
   *
   * It asked for the LIBRARY too until 2026-08-19, and that half could never answer: no writer in
   * the app puts a `location: 'cloud'` row in the catalogue — `localBackend`, `adoptFile` and
   * `link` all write `'local'`, and `cloudBackend.push` only adds a twin id to a local row. The
   * library is a different feed altogether (`panels/assets/rows.ts`, built from the API page),
   * which `app/` may not reach: `eager-graph.test.ts` keeps the panels out of the Shell's first
   * screen. Widening the query also dropped the `isLocalPicture` guard, so what it really added
   * was local rows whose file cannot be decoded.
   */
  const found = useProjectPictureAssets(accepts)

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return needle === '' ? found : found.filter(asset => asset.name.toLowerCase().includes(needle))
  }, [found, search])

  return (
    <div
      className="bg-scrim fixed inset-0 z-60 flex items-center justify-center p-8"
      // On the backdrop, so a press beside the window calls the choice off — the gesture every
      // modal answers, and the slot is left holding whatever it already had.
      onPointerDown={event => {
        if (event.target === event.currentTarget) settle(null)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // On the DIALOG, not on the search box: the box is the only thing that carried it, so
        // Escape did nothing from a tile, from Cancel, or — measured on 2026-08-19 — from a
        // window just opened, whose `autoFocus` had not taken.
        onKeyDown={event => {
          if (event.key === 'Escape' && !isComposing(event)) settle(null)
        }}
        className={cn(
          'border-border bg-surface flex max-h-full w-full max-w-3xl flex-col gap-3',
          'rounded-(--radius-sc-lg) border p-4 shadow-(--sc-shadow-floating)',
        )}
      >
        <h2 id={titleId} className="text-text m-0 text-sm font-medium">
          {labels.title}
        </h2>

        <input
          type="search"
          autoFocus
          value={search}
          placeholder={labels.search}
          aria-label={labels.search}
          onChange={event => onSearch(event.target.value)}
          className={cn(FIELD, 'w-full')}
        />

        {shown.length === 0 ? (
          <EmptyState icon={mdiImageSearchOutline} message={labels.empty} />
        ) : (
          <ul className="m-0 grid list-none grid-cols-4 gap-2 overflow-y-auto p-0">
            {shown.map(asset => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => settle(asset.id)}
                  className="w-full cursor-pointer border-none bg-transparent p-0"
                >
                  <MediaTile url={posterUrl(asset) ?? undefined} caption={asset.name} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button onClick={() => settle(null)}>{labels.cancel}</Button>
        </div>
      </div>
    </div>
  )
}
