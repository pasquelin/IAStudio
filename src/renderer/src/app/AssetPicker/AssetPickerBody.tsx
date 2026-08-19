import { mdiImageSearchOutline } from '@mdi/js'
import { useMemo } from 'react'
import { posterUrl, type Asset, type AssetType } from '@shared/domain/asset'
import { Button } from '@/design/Button'
import { EmptyState } from '@/design/EmptyState'
import { MediaTile } from '@/design/MediaTile'
import { FIELD } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { isComposing } from '@/helpers/composition'
import { useProjectPictureAssets } from '@/hooks/useProjectPictureAssets'
import { useCloud } from '@/stores/cloud'

export type AssetPickerBodyProps = {
  accepts: readonly AssetType[]
  search: string
  onSearch: (search: string) => void
  titleId: string
  /** `null` calls the choice off. */
  settle: (assetId: string | null) => void
  labels: Record<'title' | 'search' | 'empty' | 'cancel' | 'remote', string>
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
  // `remote`, which is the whole difference with a slot's own list: a library row is offered
  // here because choosing one FETCHES it — see `choose` below, without which the id handed back
  // would resolve to no file at all.
  const found = useProjectPictureAssets(accepts, true)
  const busy = useCloud(state => state.busy)

  /**
   * A cloud row is pulled before its id is handed over. The drop path has always done this
   * (`droppedAsset`); this one did not, so a library picture chosen here wrote an id the slot's
   * own list could not resolve — the row then read « Image introuvable » and the engine asked
   * for a file that was never on disk.
   */
  const choose = (asset: Asset): void => {
    if (asset.location === 'local') return settle(asset.id)

    void useCloud
      .getState()
      .fetchOne(asset.id)
      // `null` when the exchange failed: the window stays up rather than filling the slot with
      // an id that resolves to nothing, and the journal says why.
      .then(arrived => {
        if (arrived) settle(arrived.id)
      })
  }
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return needle === '' ? found : found.filter(asset => asset.name.toLowerCase().includes(needle))
  }, [found, search])

  return (
    <div className="bg-scrim fixed inset-0 z-60 flex items-center justify-center p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
          // Escape closes the WINDOW, not just the field: a search box that swallowed it would
          // leave the slot waiting on something the keyboard could no longer dismiss.
          onKeyDown={event => {
            if (event.key === 'Escape' && !isComposing(event)) settle(null)
          }}
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
                  onClick={() => choose(asset)}
                  // One transfer at a time, which `useCloud` already enforces: a second press
                  // while a picture is in flight would queue a choice nobody is waiting for.
                  disabled={busy}
                  className="w-full cursor-pointer border-none bg-transparent p-0 disabled:cursor-wait"
                >
                  <MediaTile
                    url={posterUrl(asset) ?? undefined}
                    caption={asset.name}
                    // What a remote row costs is a fetch, and saying so before the click is the
                    // difference between a slow choice and a broken one.
                    badge={badgeOf(asset, labels.remote)}
                  />
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

function badgeOf(asset: Asset, label: string): string | undefined {
  return asset.location === 'local' ? undefined : label
}
