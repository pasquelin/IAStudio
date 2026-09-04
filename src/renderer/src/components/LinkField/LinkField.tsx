import { createElement, useMemo, type ReactNode } from 'react'
import type { Asset, AssetType } from '@shared/domain/asset'
import { useContextMenu } from '@/hooks/useContextMenu'
import { SelectField } from '../SelectField'
import { LinkFieldMenu } from './LinkFieldMenu'
import type { LinkPress } from './linkPress'
import { LinkFieldActions } from './LinkFieldActions'
import { LinkFieldThumbnail } from './LinkFieldThumbnail'
import { LinkFieldSlot } from './LinkFieldSlot'
export type LinkOption = {
  id: string
  name: string
  url?: string
}
export type LinkFieldProps = {
  label: string
  value: string | null
  options: readonly LinkOption[]
  valueUrl?: string
  onChange: (id: string | null) => void
  emptyLabel?: string
  missingLabel: string
  clearLabel: string
  clearHint: string
  accepts?: readonly AssetType[]
  badge?: ReactNode
  onDropAsset?: (asset: Asset) => void
  open?: LinkPress
  press?: LinkPress
  browse?: LinkPress
  busy?: boolean
  busyLabel?: string
  scId?: string
  menuExtra?: (close: () => void) => ReactNode
}
type LinkFieldViewProps = LinkFieldProps & {
  choices: Array<{ value: string; label: string; disabled?: boolean }>
  chosen?: LinkOption
  clearing?: () => void
  menu: ReturnType<typeof useContextMenu>
  shown?: string
}

function linkFieldView(props: LinkFieldViewProps) {
  const {
    label,
    value,
    onChange,
    emptyLabel,
    clearLabel,
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
    choices,
    chosen,
    clearing,
    menu,
    shown,
  } = props
  const hasMenu = Boolean(browse || (chosen && open) || clearing || menuExtra)
  const drop = (asset: Asset) => (onDropAsset ? onDropAsset(asset) : onChange(asset.id))
  return (
    <LinkFieldSlot accepts={accepts} onDrop={drop} onContextMenu={hasMenu ? menu.open : undefined}>
      <SelectField
        label={label}
        scId={scId}
        options={choices}
        value={value ?? ''}
        onChange={id => onChange(id === '' ? null : id)}
        leading={
          <LinkFieldThumbnail {...{ badge, busy, busyLabel, chosen, label, open, press, shown }} />
        }
        actions={
          <LinkFieldActions
            {...{ browse, clearLabel, emptyLabel, value }}
            onClear={() => onChange(null)}
          />
        }
      />
      {linkMenu(props)}
    </LinkFieldSlot>
  )
}

function linkMenu(props: LinkFieldViewProps) {
  const { browse, chosen, clearHint, clearLabel, clearing, menu, menuExtra, open } = props
  if (!menu.at) return null
  return (
    <LinkFieldMenu
      at={menu.at}
      onClose={menu.close}
      browse={browse}
      open={chosen && open}
      clear={clearing && { label: clearLabel, hint: clearHint, run: clearing }}
      extra={menuExtra?.(menu.close)}
    />
  )
}

export function LinkField(props: LinkFieldProps) {
  const { value, options, emptyLabel, missingLabel, onChange, valueUrl } = props
  const chosen = useMemo(() => options.find(option => option.id === value), [options, value])
  const choices = useMemo(
    () => [
      ...(emptyLabel === undefined ? [] : [{ value: '', label: emptyLabel }]),
      ...(value !== null && !chosen ? [{ value, label: missingLabel, disabled: true }] : []),
      ...options.map(option => ({ value: option.id, label: option.name })),
    ],
    [options, value, chosen, emptyLabel, missingLabel],
  )
  const menu = useContextMenu()
  const clearing = emptyLabel === undefined || value === null ? undefined : () => onChange(null)
  const shown = valueUrl ?? chosen?.url
  return createElement(linkFieldView, { ...props, choices, chosen, clearing, menu, shown })
}
