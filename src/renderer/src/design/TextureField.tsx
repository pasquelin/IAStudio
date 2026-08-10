import { mdiCheckboxBlankOutline, mdiClose, mdiTextureBox } from '@mdi/js'
import { useMemo } from 'react'
import { TIP_LEFT } from '@/helpers/tooltip'
import { Thumbnail } from './Thumbnail'
import { MenuButton } from './MenuButton'
import { MenuRow } from './MenuRow'
import { FIELD_LABEL, FIELD_ROW } from './styles'
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
}: TextureFieldProps) {
  const chosen = useMemo(() => options.find(option => option.id === value), [options, value])

  return (
    <div className={FIELD_ROW}>
      <span className={FIELD_LABEL}>{label}</span>

      <Thumbnail url={chosen?.url} className={THUMBNAIL} />

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
