import { mdiPinOffOutline } from '@mdi/js'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { favoriteThumbnailUrl, type FavoriteRecipe } from '@shared/domain/favorite'
import { Carousel } from '@/design/Carousel'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING, SHELF_OVERLAY } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { assetIcon } from '@/helpers/workspaces'
import { useFavorites } from '@/stores/favorites'
import { useProject } from '@/stores/project'
import { Section } from '../Section'
import { ShelfTile, SHELF_TILE_SIZE } from '../ShelfCard'
import { recreate } from '../recreate'

/**
 * The recipes worth keeping, whichever project one is in.
 *
 * That is what tells this shelf from the creations above it: those belong to a project and go
 * with it, while a favourite is a way of working that follows the person.
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
        itemWidth={SHELF_TILE_SIZE}
        itemHeight={SHELF_TILE_SIZE}
        label={t('home.sections.favorites')}
        renderCard={recipe => <Tile recipe={recipe} />}
      />
    </Section>
  )
}

function Tile({ recipe }: { recipe: FavoriteRecipe }) {
  const { t } = useTranslation()
  // The shelf stands with no project — that is what "outside every project" means — but running
  // a recipe writes an asset, and there would be no folder to write it into. Inert, as a library
  // tile is: leaving the home for an empty space with an armed generator helps nobody.
  const hasProject = useProject(state => state.project !== null)

  return (
    <ShelfTile
      url={recipe.hasThumbnail ? favoriteThumbnailUrl(recipe.id) : undefined}
      caption={recipe.label}
      fallbackIcon={assetIcon(recipe.type)}
      hint={recipe.generation.prompt || recipe.label}
      label={t('home.creations.recreate', { model: recipe.label })}
      {...(hasProject ? { onClick: () => recreate(recipe.type, recipe.generation) } : {})}
      corner={<Unpin recipe={recipe} />}
    />
  )
}

/**
 * Revealed by hovering the shelf, like the carousel's own arrows: a permanent cross over every
 * picture turns a shelf of work into a shelf of controls.
 */
function Unpin({ recipe }: { recipe: FavoriteRecipe }) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={() => void useFavorites.getState().unpin(recipe.id)}
      aria-label={t('home.favorites.unpin', { name: recipe.label })}
      className={cn(
        SHELF_OVERLAY,
        'text-muted hover:text-text top-1 right-1 size-6 focus-visible:opacity-100',
        FOCUS_RING,
      )}
    >
      <UiIcon path={mdiPinOffOutline} size={13} />
    </button>
  )
}
