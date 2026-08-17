import { useTranslation } from 'react-i18next'
import type { SettingValue } from '@shared/domain/settings-path'
import {
  boundsOf,
  optionLabel,
  optionsOf,
  type SettingDescriptor,
} from '@shared/domain/settings-registry'
import { cn } from '@/helpers/cn'
import { formatDecimal } from '@/helpers/format'
import { WINDOW_CAPTION } from '@/design/window-styles'
import type { Labelled } from './controls'
import { SettingRowColorControl } from './SettingRowColorControl'
import { SettingRowPathControl } from './SettingRowPathControl'
import { SettingRowTextControl } from './SettingRowTextControl'

/**
 * What a numeric field may hand over. An emptied field is mid-edit, and a value zod would
 * refuse — a decimal where one is not expected, or one outside the declared bounds — must not
 * be sent at all: the write would reject in the main process and leave the field showing a
 * number nothing stored.
 *
 * Sliders are the exception to the integer rule: theirs is a `step` below one, which is the
 * whole reason they are sliders rather than counters.
 */
function writableNumber(descriptor: SettingDescriptor, value: number): boolean {
  if (descriptor.kind !== 'slider' && !Number.isInteger(value)) return false

  const { min, max } = boundsOf(descriptor.path)
  return value >= min && value <= max
}

/** Decimals implied by the step, so `0.05` reads `1.15` and `1` reads `3`. */
function decimalsOf(step: number | undefined): number {
  return step && step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0
}

export function SettingRowControl({
  descriptor,
  id,
  describedBy,
  value,
  onChange,
}: Labelled & {
  descriptor: SettingDescriptor
  value: SettingValue | undefined
  onChange: (value: SettingValue | undefined) => void
}) {
  const { t, i18n } = useTranslation()
  const decimals = decimalsOf(descriptor.step)

  switch (descriptor.kind) {
    case 'choice':
      return (
        <select
          id={id}
          aria-describedby={describedBy}
          className="select select-sm w-full max-w-xs"
          value={String(value ?? '')}
          // Handed back as the option declared it, not as the string the DOM carries: a
          // numeric choice would otherwise be stored as `'3'` and refused by zod.
          onChange={event =>
            onChange(
              optionsOf(descriptor).find(option => String(option.value) === event.target.value)
                ?.value,
            )
          }
        >
          {optionsOf(descriptor).map(option => (
            <option key={String(option.value)} value={String(option.value)}>
              {optionLabel(option, t)}
            </option>
          ))}
        </select>
      )

    case 'number':
      return (
        <input
          id={id}
          aria-describedby={describedBy}
          className="input input-sm w-24"
          type="number"
          min={descriptor.min}
          max={descriptor.max}
          step={descriptor.step}
          value={typeof value === 'number' ? value : ''}
          onChange={event => {
            const next = event.target.valueAsNumber
            if (writableNumber(descriptor, next)) onChange(next)
          }}
        />
      )

    case 'slider':
      return (
        <div className="flex items-center gap-2">
          <input
            id={id}
            aria-describedby={describedBy}
            className="range range-xs w-40"
            type="range"
            min={descriptor.min}
            max={descriptor.max}
            step={descriptor.step}
            value={typeof value === 'number' ? value : 0}
            onChange={event => {
              const next = event.target.valueAsNumber
              if (writableNumber(descriptor, next)) onChange(next)
            }}
          />
          <span className={cn(WINDOW_CAPTION, 'w-10 text-right tabular-nums')}>
            {typeof value === 'number'
              ? formatDecimal(value, i18n.language, { digits: decimals, least: decimals })
              : ''}
          </span>
        </div>
      )

    case 'boolean':
      return (
        <input
          id={id}
          aria-describedby={describedBy}
          className="toggle toggle-sm"
          type="checkbox"
          checked={value === true}
          onChange={event => onChange(event.target.checked)}
        />
      )

    case 'color':
      return (
        <SettingRowColorControl
          id={id}
          describedBy={describedBy}
          value={value}
          onChange={onChange}
        />
      )

    case 'path':
      return (
        <SettingRowPathControl
          descriptor={descriptor}
          id={id}
          describedBy={describedBy}
          stored={value}
          // Empty means "unset": the key is dropped rather than stored blank, which is what
          // lets ffmpeg fall back to the bundled binary and then to the PATH.
          onCommit={typed => onChange(typed === '' ? undefined : typed)}
        />
      )

    default:
      return (
        <SettingRowTextControl
          descriptor={descriptor}
          id={id}
          describedBy={describedBy}
          stored={value}
          // Empty means "unset": the key is dropped rather than stored blank, which is what
          // lets ffmpeg fall back to the bundled binary and then to the PATH.
          onCommit={typed => onChange(typed === '' ? undefined : typed)}
        />
      )
  }
}
