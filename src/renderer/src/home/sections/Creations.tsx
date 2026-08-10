import { mdiCreationOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { posterUrl, type Asset } from '@shared/domain/asset'
import { homeSectionLimit } from '@shared/domain/home'
import { Carousel } from '@/design/Carousel'
import { FOCUS_RING } from '@/design/styles'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { assetIcon } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { RefusedSection } from '../RefusedSection'
import { Section } from '../Section'
import { openFromHome } from '../open'
import { ShelfTile, SHELF_TILE_SIZE } from '../ShelfCard'
import { recreate } from '../recreate'
import { useShelf } from '../use-shelf'

const NOTHING: readonly Asset[] = []

/**
 * What this project has produced, newest first, each tile one click from being made again.
 *
 * The click costs nothing: the catalogue stores the model, the prompt and the parameters beside
 * every generated asset, so recreating is a form being filled in — not a request, not a lookup,
 * and it works with the network down.
 */
export function Creations() {
  const { t } = useTranslation()
  const path = useProject(state => state.project?.path ?? null)
  const sections = useSettings(state => state.settings.home.sections)
  const limit = homeSectionLimit(sections, 'creations')

  const {
    value: assets,
    state,
    retry,
  } = useShelf(
    NOTHING,
    () => getBridge()?.assets.search({ generated: true, limit }),
    `${path}/${limit}`,
  )

  // The local catalogue rarely refuses — and when it does, an empty band said nothing about it.
  if (state === 'refused')
    return <RefusedSection id="creations" title={t('home.sections.creations')} onRetry={retry} />

  if (assets.length === 0) return null

  return (
    <Section id="creations" title={t('home.sections.creations')}>
      <Carousel
        items={assets}
        itemWidth={SHELF_TILE_SIZE}
        itemHeight={SHELF_TILE_SIZE}
        label={t('home.sections.creations')}
        renderCard={asset => <Tile asset={asset} />}
      />
    </Section>
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
  if (!generation) return null

  const model = generation.modelLabel || asset.name

  return (
    <ShelfTile
      url={posterUrl(asset) ?? undefined}
      // The model, as on scenario.com: a row of file names says what one already knows.
      caption={model}
      fallbackIcon={assetIcon(asset.type)}
      hint={generation.prompt || asset.name}
      label={t('home.open', { name: asset.name })}
      onClick={() => openFromHome(asset)}
      corner={<Recreate asset={asset} generation={generation} model={model} />}
    />
  )
}

/**
 * Revealed by hovering the shelf, like the recipes' own unpin: a permanent button over every
 * picture turns a shelf of work into a shelf of controls.
 */
function Recreate({
  asset,
  generation,
  model,
}: {
  asset: Asset
  generation: NonNullable<Asset['generation']>
  model: string
}) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={() => recreate(asset.type, generation)}
      aria-label={t('home.creations.recreate', { model })}
      className={cn(
        'border-border bg-panel/90 text-muted hover:text-text absolute top-1 right-1 z-10',
        'flex size-6 cursor-pointer items-center justify-center rounded-full border',
        'opacity-0 transition-opacity group-hover/carousel:opacity-100 focus-visible:opacity-100',
        FOCUS_RING,
      )}
    >
      <UiIcon path={mdiCreationOutline} size={13} />
    </button>
  )
}
