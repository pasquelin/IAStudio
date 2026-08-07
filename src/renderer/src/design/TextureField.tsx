import { mdiCheckboxBlankOutline, mdiClose, mdiTextureBox } from '@mdi/js'
import { TIP_LEFT } from '@/helpers/tooltip'
import { Thumbnail } from './MediaTile'
import { MenuButton } from './MenuButton'
import { MenuRow } from './MenuRow'
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
}

/** The thumbnail matches the control gauge, so a slot is exactly one row tall. */
const THUMBNAIL = 'size-(--sc-control)'

/**
 * One texture slot: what it holds, and a menu of what the project can put in it.
 *
 * What travels is the asset's identifier and never an image — the engine is what loads, caches
 * and frees the picture, so a scene reopened tomorrow resolves the same reference again.
 */
export function TextureField({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  clearLabel,
  chooseLabel,
}: TextureFieldProps) {
  const chosen = options.find(option => option.id === value)

  return (
    <div className="flex min-w-0 items-center gap-1 text-[11px]">
      <span className="text-muted w-16 shrink-0 truncate">{label}</span>

      <Thumbnail url={chosen?.url} shape={THUMBNAIL} />

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
    </div>
  )
}
