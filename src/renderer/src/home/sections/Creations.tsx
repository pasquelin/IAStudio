import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { posterUrl, type Asset } from '@shared/domain/asset'
import { homeSectionLimit } from '@shared/domain/home'
import { Carousel } from '@/design/Carousel'
import { MediaTile } from '@/design/MediaTile'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { assetIcon } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Section } from '../Section'
import { recreate } from '../recreate'

const CARD = 132

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

  const [assets, setAssets] = useState<readonly Asset[]>([])

  // Read on the way in, and again when the project changes. The home is unmounted the moment a
  // workspace takes over, so coming back is what refreshes it — the bargain the documents shelf
  // already makes, and the reason neither of them subscribes to the catalogue.
  useEffect(() => {
    let live = true

    getBridge()
      ?.assets.search({ generated: true, limit })
      .then(found => {
        if (live) setAssets(found)
      })
      // No project open: an empty shelf is the honest answer, and the section removes itself.
      .catch(() => {})

    return () => {
      live = false
    }
  }, [path, limit])

  if (assets.length === 0) return null

  return (
    <Section id="creations" title={t('home.sections.creations')}>
      <Carousel
        items={assets}
        itemWidth={CARD}
        itemHeight={CARD}
        label={t('home.sections.creations')}
        renderCard={asset => <Tile asset={asset} />}
      />
    </Section>
  )
}

/**
 * One creation. The whole tile recreates rather than a button in its corner: this shelf exists
 * for that one gesture, and a picture that opens nothing when clicked is a picture that lies.
 *
 * The caption is the model, as it is on scenario.com — a row of file names says what one already
 * knows, while the model is what one is looking for when hunting a look down.
 */
function Tile({ asset }: { asset: Asset }) {
  const { t } = useTranslation()
  const generation = asset.generation
  if (!generation) return null

  return (
    <button
      type="button"
      onClick={() => recreate(asset.type, generation)}
      title={generation.prompt || asset.name}
      aria-label={t('home.creations.recreate', { model: generation.modelLabel || asset.name })}
      className={cn(
        'block size-full cursor-pointer rounded-(--radius-sc-md) border-none bg-transparent p-0',
        'hover:opacity-90',
        FOCUS_RING,
      )}
    >
      <MediaTile
        url={posterUrl(asset) ?? undefined}
        caption={generation.modelLabel || asset.name}
        fallbackIcon={assetIcon(asset.type)}
      />
    </button>
  )
}
