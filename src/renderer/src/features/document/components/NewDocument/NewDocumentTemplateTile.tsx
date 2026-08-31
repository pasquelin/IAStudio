import { MediaTile } from '@/components/MediaTile'
import { rowSkin } from '@/components/styles'
import { cn } from '@/helpers/cn'
import { HINT_BOTTOM } from '@/helpers/tooltip'

export type NewDocumentTemplateTileProps = {
  /** The `data-sc` handle and the key alike — what a script picks this row by. */
  id: string
  caption: string
  hint: string
  icon: string
  /** The still drawn of this template, where one is shipped. A GUI template has none. */
  url?: string
  selected: boolean
  onPick: () => void
}

/**
 * One template to choose from, whatever kind is being named.
 *
 * Written once because two sections draw it now — a scene opens on eight of these and an
 * interface on four — and the subtle parts are shared: the picked state is `aria-pressed` like
 * every exclusive row of this studio, `rowSkin` publishes it through `data-selected`, and `cn`
 * keeps the LAST of two conflicting fills, so a background written here would undo the selection.
 */
export function NewDocumentTemplateTile({
  id,
  caption,
  hint,
  icon,
  url,
  selected,
  onPick,
}: NewDocumentTemplateTileProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      // On the element that wears the skin: a background painted without it says nothing to a
      // reader.
      data-selected={selected || undefined}
      data-sc={`field:document.template.${id}`}
      {...HINT_BOTTOM(hint)}
      onClick={onPick}
      className={cn(
        rowSkin(selected, { surface: 'tile' }),
        'w-full cursor-pointer border-none p-1',
      )}
    >
      <MediaTile url={url} caption={caption} fallbackIcon={icon} />
    </button>
  )
}
