import { mdiClose, mdiFolderSearchOutline } from '@mdi/js'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Asset, AssetType } from '@shared/domain/asset'
import { activation } from '@/helpers/activation'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { Flyout } from '../Flyout'
import { SelectField } from '../SelectField'
import { Spinner } from '../Spinner'
import { Thumbnail } from '../Thumbnail'
import { FIELD_THUMBNAIL, ROW_ACTION_SPACER } from '../styles'
import { ToolButton } from '../ToolButton'
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
  /** The kinds a drag may drop here. Absent leaves the slot undroppable. */
  accepts?: readonly AssetType[]
  /** A standing laid over the picture — never an action, the slot `MediaTile` reserves by name. */
  badge?: ReactNode
  /**
   * What a drop puts here, when the caller needs the ASSET rather than its id — a texture channel
   * keeps what the picture measures. Absent, a drop is the same gesture as choosing from the list.
   */
  onDropAsset?: (asset: Asset) => void
  /**
   * Opening what the slot holds — a double-click on its picture, and Enter with it.
   *
   * `toggled` names both jobs it does: it turns that press into a TOGGLE, answering a single
   * click, and it says where the toggle stands. Nothing is opened when the press only changes how
   * the slot is looked at.
   */
  open?: { label: string; hint: string; run: () => void; toggled?: boolean }
  /** Choosing from the whole project rather than from `options`. Absent, no button is drawn. */
  browse?: { label: string; hint: string; run: () => void }
  /** While what the slot points at is being fetched. */
  busy?: boolean
  busyLabel?: string
  /** The handle the MCP steers this link by. Never a translated word. */
  scId?: string
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
  accepts,
  badge,
  onDropAsset,
  open,
  browse,
  busy,
  busyLabel,
  scId,
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
  const [preview, setPreview] = useState<HTMLElement | null>(null)
  const resting = useRef<number | null>(null)

  const forget = (): void => {
    if (resting.current !== null) window.clearTimeout(resting.current)
    resting.current = null
  }

  useEffect(() => forget, [])

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
            {open && chosen ? (
              <button
                type="button"
                aria-pressed={open.toggled}
                {...(open.toggled === undefined ? activation(open.run) : { onClick: open.run })}
                {...TIP_LEFT(open.label, false, open.hint)}
                onPointerEnter={event => {
                  const anchor = event.currentTarget
                  forget()
                  resting.current = window.setTimeout(() => setPreview(anchor), PREVIEW_DELAY)
                }}
                onPointerLeave={() => {
                  forget()
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
    </LinkFieldSlot>
  )
}
