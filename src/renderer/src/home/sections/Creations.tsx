import { useTranslation } from 'react-i18next'
import { posterUrl, type Asset } from '@shared/domain/asset'
import { homeSectionLimit } from '@shared/domain/home'
import { Carousel } from '@/design/Carousel'
import { assetIcon } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Section } from '../Section'
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

  const assets = useShelf(
    NOTHING,
    () => getBridge()?.assets.search({ generated: true, limit }),
    `${path}/${limit}`,
  )

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
 * One creation. The whole tile recreates rather than a button in its corner: this shelf exists
 * for that one gesture, and a picture that opens nothing when clicked is a picture that lies.
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
      label={t('home.creations.recreate', { model })}
      onClick={() => recreate(asset.type, generation)}
    />
  )
}
