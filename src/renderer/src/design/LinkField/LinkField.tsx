import { mdiClose, mdiFolderSearchOutline } from '@mdi/js'
import { useMemo, useState, type ReactNode } from 'react'
import type { Asset, AssetType } from '@shared/domain/asset'
import { useContextMenu } from '@/hooks/useContextMenu'
import { useForgettableTimeout } from '@/hooks/useForgettableTimeout'
import { useDeferredPress } from '@/hooks/useDeferredPress'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { Flyout } from '../Flyout'
import { SelectField } from '../SelectField'
import { Spinner } from '../Spinner'
import { Thumbnail } from '../Thumbnail'
import { FIELD_THUMBNAIL, ROW_ACTION_SPACER } from '../styles'
import { ToolButton } from '../ToolButton'
import { LinkFieldMenu } from './LinkFieldMenu'
import type { LinkPress } from './linkPress'
import { LinkFieldSlot } from './LinkFieldSlot'

export type LinkOption = {
  id: string
  name: string
  /** Where the picture is served from, for the thumbnail. */
  url?: string
}

export type LinkFieldProps = {
  label: string
  /** What the slot points at, or `null` for a link that holds nothing. */
  value: string | null
  options: readonly LinkOption[]
  onChange: (id: string | null) => void
  /**
   * Shown in place of a name while the slot is empty. **Absent means the link cannot be empty** —
   * no empty entry, no clearing cross, and `onChange` is never handed `null`. A caption has to be
   * set in some typeface, and offering to unset it is offering a state that has no meaning.
   */
  emptyLabel?: string
  /**
   * What the row reads when `value` names something `options` no longer holds. Required, because
   * the alternative is a lie: a `<select>` given a value none of its options carries falls back
   * to the first one, so a deleted texture came out reading as the one at the top of the list.
   */
  missingLabel: string
  clearLabel: string
  /** What emptying the slot explains — the menu row reads it. */
  clearHint: string
  /** The kinds a drag may drop here. Absent leaves the slot undroppable. */
  accepts?: readonly AssetType[]
  /** A standing laid over the picture — never an action, the slot `MediaTile` reserves by name. */
  badge?: ReactNode
  /**
   * What a drop puts here, when the caller needs the ASSET rather than its id — a texture channel
   * keeps what the picture measures. Absent, a drop is the same gesture as choosing from the list.
   */
  onDropAsset?: (asset: Asset) => void
  /** Opening what the slot holds — a double-click on its picture, and Enter with it. */
  open?: LinkPress
  /**
   * What a SINGLE click on the picture does. It waits out the double-click window, so a press that
   * opens a window of its own does not flash under a double-click meant for `open`.
   */
  press?: LinkPress
  /** Choosing from the whole project rather than from `options`. Absent, no button is drawn. */
  browse?: LinkPress
  /** While what the slot points at is being fetched. */
  busy?: boolean
  busyLabel?: string
  /** The handle the MCP steers this link by. Never a translated word. */
  scId?: string
  /**
   * Menu rows belonging to the SURFACE rather than to the slot — a channel's flat view, its
   * recipe. Handed the closer, since a row is what shuts the menu it was chosen in.
   */
  menuExtra?: (close: () => void) => ReactNode
}

/** Milliseconds the pointer rests on the picture before it is shown large. */
const PREVIEW_DELAY = 400

/**
 * One link from a document to another — the texture a material wears, the sky a scene is lit by,
 * the typeface a caption is set in. What travels is the identifier, never an image.
 *
 * The row is the shared two-column property line: the name on the left like every other
 * attribute, then the picture, the list of what can fill the slot, and what one does with it.
 */
export function LinkField({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  missingLabel,
  clearLabel,
  clearHint,
  accepts,
  badge,
  onDropAsset,
  open,
  press,
  browse,
  busy,
  busyLabel,
  scId,
  menuExtra,
}: LinkFieldProps) {
  const chosen = useMemo(() => options.find(option => option.id === value), [options, value])
  /**
   * Empty first, then what the project holds. A value `options` does not carry is added as its own
   * disabled entry rather than left to the browser's fallback — see `missingLabel`.
   *
   * Memoised because the inspector re-renders on every value a drag emits and a mesh stacks five
   * of these: composed inline, each frame rebuilt five arrays as long as the project's pictures.
   */
  const choices = useMemo(
    () => [
      ...(emptyLabel === undefined ? [] : [{ value: '', label: emptyLabel }]),
      ...(value !== null && !chosen ? [{ value, label: missingLabel, disabled: true }] : []),
      ...options.map(option => ({ value: option.id, label: option.name })),
    ],
    [options, value, chosen, emptyLabel, missingLabel],
  )
  // Named for what a SINGLE click does where there is one: the gesture a hand reaches for first is
  // the one the tooltip has to describe.
  const named = press ?? open
  const gestures = useDeferredPress(press?.run, open?.run)
  const menu = useContextMenu()
  const clearing = emptyLabel === undefined || value === null ? undefined : () => onChange(null)
  // A right-click that opens an empty surface answers by covering the row it was aimed at.
  const hasMenu = Boolean(browse || (chosen && open) || clearing || menuExtra)
  const [preview, setPreview] = useState<HTMLElement | null>(null)
  const resting = useForgettableTimeout()

  const picture = (
    <span className={cn(FIELD_THUMBNAIL, 'relative shrink-0')}>
      <Thumbnail url={chosen?.url} className={FIELD_THUMBNAIL} />
      {/* The same veil the asset browser draws while a library picture is being fetched: a slot
          that simply stayed empty read as a drop that had failed. */}
      {busy && busyLabel && (
        <span className="bg-scrim absolute inset-0 grid place-items-center rounded-(--radius-sc-sm)">
          <Spinner label={busyLabel} />
        </span>
      )}
    </span>
  )

  return (
    <LinkFieldSlot
      accepts={accepts}
      onDrop={asset => (onDropAsset ? onDropAsset(asset) : onChange(asset.id))}
      onContextMenu={hasMenu ? menu.open : undefined}
    >
      <SelectField
        label={label}
        scId={scId}
        options={choices}
        value={value ?? ''}
        onChange={id => onChange(id === '' ? null : id)}
        leading={
          // `flex`, so the picture is a flex item and not a line of text: left inline, the image
          // sits on the baseline and the descender space under it made a FILLED row taller than
          // an empty one — the box below carries no height of its own.
          <span className="relative flex shrink-0">
            {/* Guarded on what the slot RESOLVED to, never on the id it holds: a document outlives
                the picture it points at, and an id whose asset has left the project offered to
                open something no longer there — a focus stop leading nowhere is a Tab to cross. */}
            {named && chosen ? (
              <button
                type="button"
                {...gestures}
                {...TIP_LEFT(named.label, false, named.hint)}
                onPointerEnter={event => {
                  const anchor = event.currentTarget
                  resting.after(PREVIEW_DELAY, () => setPreview(anchor))
                }}
                onPointerLeave={() => {
                  resting.forget()
                  setPreview(null)
                }}
                className="cursor-pointer rounded-(--radius-sc-sm) border-none bg-transparent p-0"
              >
                {picture}
              </button>
            ) : (
              picture
            )}

            {/* After the press, so it is painted over it rather than under. `TileMark` takes no
                pointer of its own, which is what leaves the whole picture pressable. */}
            {badge}
          </span>
        }
        actions={
          /* Both places are held whatever is drawn in them, so every link line ends on the column
             the fields end on — and so choosing a picture, which is what raises the cross, does not
             narrow the select the pointer is still over. */
          <>
            {browse && (
              <ToolButton
                icon={mdiFolderSearchOutline}
                label={browse.label}
                description={browse.hint}
                tooltip={TIP_LEFT}
                variant="header"
                onClick={browse.run}
              />
            )}
            {/* Only where empty is a state this link HAS — a font is set in something, so that
                row has no cross at all. Drawn and inert while there is nothing to clear, which is
                what keeps the select from narrowing under the pointer at the first picture. */}
            {emptyLabel === undefined ? (
              // The place kept is the LAST one, so a browse button stays on the column its
              // neighbours put theirs on rather than sliding to the end.
              <span aria-hidden className={ROW_ACTION_SPACER} />
            ) : (
              <ToolButton
                icon={mdiClose}
                label={clearLabel}
                tooltip={TIP_LEFT}
                variant="header"
                disabled={value === null}
                onClick={() => onChange(null)}
              />
            )}
          </>
        }
      />

      {/* A 28px thumbnail is not enough to tell a normal map from an albedo. Shown only once the
          pointer has RESTED: opening on every crossing would flash over a stack of five slots. */}
      {preview && chosen?.url && (
        <Flyout anchor={preview} placement="right">
          <img src={chosen.url} alt={chosen.name} className="max-h-64 max-w-64 object-contain" />
        </Flyout>
      )}

      {/* Guarded on what the slot RESOLVED to, like the press: an id whose asset has left the
          project has nothing to open. */}
      {menu.at && (
        <LinkFieldMenu
          at={menu.at}
          onClose={menu.close}
          browse={browse}
          open={chosen && open}
          clear={clearing && { label: clearLabel, hint: clearHint, run: clearing }}
          extra={menuExtra?.(menu.close)}
        />
      )}
    </LinkFieldSlot>
  )
}
