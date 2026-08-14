import { mdiCheckboxBlankOutline, mdiClose, mdiTextureBox } from '@mdi/js'
import { useMemo, type ReactNode } from 'react'
import type { AssetType } from '@shared/domain/asset'
import { activation } from '@/helpers/activation'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT, TIP_LEFT } from '@/helpers/tooltip'
import { AssetDropTarget } from './AssetDropTarget'
import { Thumbnail } from './Thumbnail'
import { MenuButton } from './MenuButton'
import { MenuRow } from './MenuRow'
import { FIELD_LABEL, FIELD_ROW, FOCUS_RING } from './styles'
import { ToolButton } from './ToolButton'

export type TextureOption = {
  id: string
  name: string
  /** Where the picture is served from, for the thumbnail. */
  url?: string
}

export type TextureFieldProps = {
  label: string
  /** The chosen asset, or `null` for a slot holding no texture. */
  value: string | null
  options: readonly TextureOption[]
  onChange: (assetId: string | null) => void
  /** Shown in place of a name while the slot is empty. */
  emptyLabel: string
  clearLabel: string
  chooseLabel: string
  /**
   * What the two kinds of row DO, in a sentence. Required, and separate from the labels: a menu
   * row reads its own name already, and what a caller means by "None" — no picture, the studio's
   * own light, the document's font — is exactly what the label cannot say.
   */
  emptyHint: string
  optionHint: string
  /**
   * The kinds a drag may drop into this slot. Absent leaves the field undroppable, which is what
   * a slot filled from something other than the catalogue wants — `FontField` offers the fonts
   * of the system, and no asset of the project is one.
   */
  accepts?: readonly AssetType[]
  /**
   * OPENING what the slot holds — the double-click on its picture, and Enter with it. The caller
   * owns it because it alone knows what `value` names; absent, the picture stays inert.
   */
  onOpen?: () => void
  /** What the double-click does, for the reader that cannot see it. Required with `onOpen`. */
  openLabel?: string
}

/** The thumbnail matches the control gauge, so a slot is exactly one row tall. */
const THUMBNAIL = 'size-(--sc-control)'

/**
 * One texture slot: what it holds, and a menu of what the project can put in it. What travels
 * is the asset's identifier and never an image — the engine loads, caches and frees the picture.
 */
export function TextureField({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  clearLabel,
  chooseLabel,
  emptyHint,
  optionHint,
  accepts,
  onOpen,
  openLabel,
}: TextureFieldProps) {
  const chosen = useMemo(() => options.find(option => option.id === value), [options, value])

  const picture = <Thumbnail url={chosen?.url} className={THUMBNAIL} />

  return (
    <DroppableSlot accepts={accepts} onDrop={onChange}>
      <span title={label} className={FIELD_LABEL}>
        {label}
      </span>

      {/* A button only where there is something to open: an empty slot double-clicked would take
          the user to nothing, and a focus stop that leads nowhere is one more Tab to cross. */}
      {onOpen && openLabel && value !== null ? (
        <button
          type="button"
          {...activation(onOpen)}
          {...TIP_LEFT(openLabel, false, undefined)}
          className={cn(
            'shrink-0 cursor-pointer rounded-(--radius-sc-md) border-none bg-transparent p-0',
            FOCUS_RING,
          )}
        >
          {picture}
        </button>
      ) : (
        picture
      )}

      <span className="text-muted min-w-0 flex-1 truncate">{chosen?.name ?? emptyLabel}</span>

      <MenuButton
        icon={mdiTextureBox}
        label={chooseLabel}
        tooltip={TIP_LEFT}
        variant="header"
        opensOnClick
        disabled={options.length === 0}
        // "None" is one of the choices, not a separate button: choosing no texture is choosing.
        rowCount={options.length + 1}
        rows={close => [
          <MenuRow
            key="none"
            label={emptyLabel}
            icon={mdiCheckboxBlankOutline}
            checked={value === null}
            tick="one-of"
            tip={HINT_RIGHT(emptyHint)}
            onSelect={() => {
              onChange(null)
              close()
            }}
          />,
          ...options.map(option => (
            <MenuRow
              key={option.id}
              label={option.name}
              icon={mdiTextureBox}
              checked={option.id === value}
              tick="one-of"
              tip={HINT_RIGHT(optionHint)}
              onSelect={() => {
                onChange(option.id)
                close()
              }}
            />
          )),
        ]}
      />

      {/* Only when there is something to clear: a dead cross on each of the five empty slots of
          a fresh material is five buttons that do nothing. */}
      {value !== null && (
        <ToolButton
          icon={mdiClose}
          label={clearLabel}
          tooltip={TIP_LEFT}
          variant="header"
          onClick={() => onChange(null)}
        />
      )}
    </DroppableSlot>
  )
}

/**
 * The row itself, made a drop target only where a drop means something.
 *
 * Wrapped rather than made conditional inside the row: `AssetDropTarget` owns the outline that
 * says WHICH slot a drop would land in, and a field that mounted one unconditionally would light
 * up on a drag it has no use for. `exclusive`, because these slots sit inside the panel's own
 * target — without it both would frame at once and the answer would name two places.
 */
function DroppableSlot({
  accepts,
  onDrop,
  children,
}: {
  accepts?: readonly AssetType[]
  onDrop: (assetId: string) => void
  children: ReactNode
}) {
  if (!accepts) return <div className={FIELD_ROW}>{children}</div>

  return (
    <AssetDropTarget
      accepts={accepts}
      exclusive
      onDrop={asset => onDrop(asset.id)}
      className={FIELD_ROW}
    >
      {children}
    </AssetDropTarget>
  )
}
