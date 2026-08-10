import { mdiCreationOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { posterUrl, type Asset } from '@shared/domain/asset'
import { Collection } from '@/design/Collection'
import { EmptyState } from '@/design/EmptyState'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING, SHELF_OVERLAY } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { toolIcon } from '@/helpers/tool-registry'
import { TILES_ONLY } from '@/helpers/collection-state'
import { assetIcon } from '@/helpers/workspaces'
import { useShelf } from '@/hooks/use-shelf'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'
import { openFromHome } from '@/home/open'
import { recreate } from '@/home/recreate'
import { ShelfTile } from '@/design/ShelfTile'
import { RefusedPanel } from '@/panels/shared/RefusedPanel'
import { PANEL_PAGE } from '@/panels/shared/tiles'

const NOTHING: readonly Asset[] = []

/**
 * What this project has produced, newest first, each tile one click from being made again.
 *
 * Recreating costs nothing: the catalogue stores the model, the prompt and the parameters beside
 * every generated asset, so it is a form being filled in — not a request, not a lookup, and it
 * works with the network down.
 */
export function Creations() {
  const { t } = useTranslation()
  const path = useProject(state => state.project?.path ?? null)

  const {
    value: assets,
    state,
    retry,
  } = useShelf(
    NOTHING,
    () => getBridge()?.assets.search({ generated: true, limit: PANEL_PAGE }),
    path ?? '',
  )

  // The local catalogue rarely refuses — and when it does, an empty panel says nothing about it.
  if (state === 'refused') return <RefusedPanel tool="creations" onRetry={retry} />

  return (
    <Collection
      label={t('panels.creations')}
      items={assets}
      state={TILES_ONLY}
      // The click is the tile's own rather than the collection's, as it is in the library beside
      // it: `onOpen` would name the cell, and the verb — "open boulder.png" — is what a reader
      // hears instead of "listitem". Two grids of the same tile must not answer differently.
      renderCard={asset => <Tile asset={asset} />}
      empty={<EmptyState icon={toolIcon('creations')} message={t('home.creations.none')} />}
    />
  )
}

/**
 * One creation. The tile OPENS it; recreating is the corner action.
 *
 * That is the way round a click on a picture is read — "I click a thumbnail, there is some
 * activity, but it does not open the file". Three shelves drew the same square and did three
 * different things with it, none of which was opening.
 */
function Tile({ asset }: { asset: Asset }) {
  const { t } = useTranslation()
  const generation = asset.generation
  const model = generation?.modelLabel || asset.name

  return (
    <ShelfTile
      url={posterUrl(asset) ?? undefined}
      // The model, as on scenario.com: a row of file names says what one already knows.
      caption={model}
      fallbackIcon={assetIcon(asset.type)}
      hint={generation?.prompt || asset.name}
      label={t('home.open', { name: asset.name })}
      tip={TIP_LEFT}
      onClick={() => void openFromHome(asset)}
      corner={
        generation && (
          <Recreate
            model={model}
            prompt={generation.prompt}
            onClick={() => recreate(asset.type, generation)}
          />
        )
      }
    />
  )
}

/**
 * Revealed by hovering the tile, like the recipes' own unpin: a permanent button over every
 * picture turns a panel of work into a panel of controls.
 *
 * `TIP_LEFT` because the host is the right column: the placement comes from where the button
 * sits, never from the button. The prompt goes through as it is — `tipFor` already reads an
 * empty description as none, and guarding it here would be a second answer to one question.
 */
function Recreate({
  model,
  prompt,
  onClick,
}: {
  model: string
  prompt: string
  onClick: () => void
}) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onClick}
      {...TIP_LEFT(t('home.creations.recreate', { model }), false, prompt)}
      className={cn(
        SHELF_OVERLAY,
        'text-muted hover:text-text top-1 right-1 size-6 focus-visible:opacity-100',
        FOCUS_RING,
      )}
    >
      <UiIcon path={mdiCreationOutline} size={13} />
    </button>
  )
}
