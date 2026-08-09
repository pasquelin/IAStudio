import { mdiPinOffOutline } from '@mdi/js'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { favoriteThumbnailUrl, type FavoriteRecipe } from '@shared/domain/favorite'
import { Carousel } from '@/design/Carousel'
import { MediaTile } from '@/design/MediaTile'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { assetIcon } from '@/helpers/workspaces'
import { useFavorites } from '@/stores/favorites'
import { Section } from '../Section'
import { recreate } from '../recreate'

const CARD = 132

/**
 * The recipes worth keeping, whichever project one is in.
 *
 * That is what tells this shelf from the one above it: creations belong to a project and go with
 * it, while a favourite is a way of working that follows the person. Nothing about it is stored
 * in the catalogue, and nothing about it expires.
 */
export function Favorites() {
  const { t } = useTranslation()
  const recipes = useFavorites(state => state.recipes)

  useEffect(() => void useFavorites.getState().load(), [])

  if (recipes.length === 0) return null

  return (
    <Section id="favorites" title={t('home.sections.favorites')}>
      <Carousel
        items={recipes}
        itemWidth={CARD}
        itemHeight={CARD}
        label={t('home.sections.favorites')}
        renderCard={recipe => <Tile recipe={recipe} />}
      />
    </Section>
  )
}

/**
 * Two buttons side by side rather than one inside the other, which no browser would accept: the
 * tile runs the recipe again, and the pin in its corner drops it.
 */
function Tile({ recipe }: { recipe: FavoriteRecipe }) {
  const { t } = useTranslation()

  return (
    <div className="relative size-full">
      <button
        type="button"
        onClick={() => recreate(recipe.type, recipe.generation)}
        title={recipe.generation.prompt || recipe.label}
        aria-label={t('home.creations.recreate', { model: recipe.label })}
        className={cn(
          'absolute inset-0 cursor-pointer rounded-(--radius-sc-md) border-none bg-transparent',
          'p-0 hover:opacity-90',
          FOCUS_RING,
        )}
      >
        <MediaTile
          url={recipe.hasThumbnail ? favoriteThumbnailUrl(recipe.id) : undefined}
          caption={recipe.label}
          fallbackIcon={assetIcon(recipe.type)}
        />
      </button>

      {/* Revealed by hovering the tile, like the carousel's own arrows: a permanent cross over
          every picture turns a shelf of work into a shelf of controls. */}
      <button
        type="button"
        onClick={() => void useFavorites.getState().unpin(recipe.id)}
        aria-label={t('home.favorites.unpin', { name: recipe.label })}
        className={cn(
          'border-border bg-panel/90 text-muted hover:text-text absolute top-1 right-1 z-10',
          'flex size-6 cursor-pointer items-center justify-center rounded-full border',
          'opacity-0 transition-opacity group-hover/carousel:opacity-100 focus-visible:opacity-100',
          FOCUS_RING,
        )}
      >
        <UiIcon path={mdiPinOffOutline} size={13} />
      </button>
    </div>
  )
}
