import { mdiRestore } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { defaultAt, valueAt, type SettingValue } from '@shared/domain/settings-path'
import { boundsOf, optionsOf, type SettingDescriptor } from '@shared/domain/settings-registry'
import { UiIcon } from '@/design/UiIcon'
import { useToken } from '@/hooks/useToken'
import { getBridge } from '@/services/bridge'
import { useSettings } from '@/stores/settings'

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

/** Text settings commit on blur; a controlled input fed by a write hands back a stale word. */
function TextControl({
  descriptor,
  id,
  describedBy,
  stored,
  onCommit,
}: {
  descriptor: SettingDescriptor
  id: string
  describedBy: string
  stored: SettingValue | undefined
  onCommit: (value: string) => void
}) {
  const { t } = useTranslation()
  // Null until touched, so a setting still on its way from the main process shows up when it
  // lands — seeding once would display an empty field over a stored value.
  const [typed, setTyped] = useState<string | null>(null)
  const [known, setKnown] = useState(stored)

  // The stored value moved under the edit — restored to its default, or changed by another
  // window. Dropping what was typed is what makes the field show the new value rather than
  // the word it was left on.
  if (stored !== known) {
    setKnown(stored)
    setTyped(null)
  }

  const commit = (): void => {
    if (typed === null) return
    const trimmed = typed.trim()

    // Handing the field back to the stored value, so trailing spaces disappear on the way out
    // rather than staying on screen — `stored` would not move, and nothing else clears this.
    setTyped(null)

    // Retyping what is already stored would cost a disk write and a broadcast to every
    // window, to change nothing.
    if (trimmed !== String(stored ?? '')) onCommit(trimmed)
  }

  return (
    <input
      id={id}
      aria-describedby={describedBy}
      className="input input-sm w-full max-w-xs"
      type="text"
      placeholder={descriptor.placeholderKey ? t(descriptor.placeholderKey) : undefined}
      value={typed ?? String(stored ?? '')}
      onChange={event => setTyped(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') commit()
      }}
    />
  )
}

/**
 * A path, with the native picker beside it. The field stays writable: a path can be pasted, and
 * one typed before the binary is plugged in has to be storable — see `media.ffmpegPath`.
 */
function PathControl({
  descriptor,
  id,
  describedBy,
  stored,
  onCommit,
}: {
  descriptor: SettingDescriptor
  id: string
  describedBy: string
  stored: SettingValue | undefined
  onCommit: (value: string) => void
}) {
  const { t } = useTranslation()

  const browse = async (): Promise<void> => {
    const picked = await getBridge()?.dialog.pickPath(descriptor.pathKind ?? 'file')
    // Null is a cancelled dialog, which must not clear what is already stored.
    if (picked) onCommit(picked)
  }

  return (
    <div className="flex items-center gap-1">
      <TextControl
        descriptor={descriptor}
        id={id}
        describedBy={describedBy}
        stored={stored}
        onCommit={onCommit}
      />
      <button type="button" className="btn btn-sm shrink-0" onClick={() => void browse()}>
        {t('settings.browse')}
      </button>
    </div>
  )
}

/**
 * A colour, shown as the one currently in effect. An unset accent is not blank — it is whatever
 * the theme declares, so that is what the swatch has to display, and `useToken` keeps it in step
 * when the theme moves underneath.
 */
function ColorControl({
  id,
  describedBy,
  value,
  onChange,
}: {
  id: string
  describedBy: string
  value: SettingValue | undefined
  onChange: (value: SettingValue) => void
}) {
  const themeAccent = useToken('--color-accent')

  return (
    <input
      id={id}
      aria-describedby={describedBy}
      className="h-(--sc-control) w-16 cursor-pointer rounded-(--radius-sc-sm)"
      type="color"
      value={typeof value === 'string' ? value : themeAccent}
      onChange={event => onChange(event.target.value)}
    />
  )
}

function Control({
  descriptor,
  id,
  describedBy,
  value,
  onChange,
}: {
  descriptor: SettingDescriptor
  id: string
  describedBy: string
  value: SettingValue | undefined
  onChange: (value: SettingValue | undefined) => void
}) {
  const { t } = useTranslation()

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
              {t(option.labelKey)}
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
          <span className="text-base-content/60 w-10 text-right text-xs tabular-nums">
            {typeof value === 'number' ? value.toFixed(decimalsOf(descriptor.step)) : ''}
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
      return <ColorControl id={id} describedBy={describedBy} value={value} onChange={onChange} />

    case 'path':
      return (
        <PathControl
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
        <TextControl
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

/**
 * One setting, rendered from its descriptor alone: its name, what it does in plain words, its
 * control, and — once it differs from the default — a way back. No screen writes a control by
 * hand, so two settings of the same kind cannot end up behaving differently.
 */
export function SettingRow({ descriptor }: { descriptor: SettingDescriptor }) {
  const { t } = useTranslation()
  // Selected down to the leaf, not the whole settings object: that one is rebuilt on every
  // write, so a row would re-render whenever any other setting — or the open project — moved.
  const value = useSettings(state => valueAt(state.settings, descriptor.path))
  const setValue = useSettings(state => state.setValue)

  const fallback = defaultAt(descriptor.path)
  const modified = value !== fallback

  const id = `setting-${descriptor.path}`
  const describedBy = `${id}-help`

  return (
    <div className="border-base-300 flex flex-col gap-1 border-b py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-xs font-medium">
          {t(descriptor.titleKey)}
        </label>

        <div className="flex shrink-0 items-center gap-1">
          <Control
            descriptor={descriptor}
            id={id}
            describedBy={describedBy}
            value={value}
            onChange={next => void setValue(descriptor.path, next)}
          />

          <button
            type="button"
            title={t('settings.restoreDefault')}
            aria-label={t('settings.restoreDefault')}
            // Kept in place rather than unmounted: a button appearing between the control and
            // the edge would shift the whole row the moment a value is touched.
            className="btn btn-ghost btn-xs btn-square"
            disabled={!modified}
            onClick={() => void setValue(descriptor.path, fallback)}
          >
            <UiIcon path={mdiRestore} size={14} className={modified ? '' : 'opacity-0'} />
          </button>
        </div>
      </div>

      <p id={describedBy} className="text-base-content/60 max-w-lg text-xs">
        {t(descriptor.helpKey)}
      </p>
    </div>
  )
}
