import { mdiRestore } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { defaultAt, valueAt, type SettingValue } from '@shared/domain/settings-path'
import { optionsOf, type SettingDescriptor } from '@shared/domain/settings-registry'
import { UiIcon } from '@/design/UiIcon'
import { useSettings } from '@/stores/settings'

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
    onCommit(typed.trim())
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
          onChange={event => onChange(event.target.value)}
        >
          {optionsOf(descriptor).map(option => (
            <option key={String(option.value)} value={String(option.value)}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
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

    case 'number':
    case 'slider':
      return (
        <input
          id={id}
          aria-describedby={describedBy}
          className={descriptor.kind === 'slider' ? 'range range-xs w-40' : 'input input-sm w-24'}
          type={descriptor.kind === 'slider' ? 'range' : 'number'}
          min={descriptor.min}
          max={descriptor.max}
          step={descriptor.step}
          value={typeof value === 'number' ? value : ''}
          onChange={event => {
            const next = event.target.valueAsNumber
            if (Number.isFinite(next)) onChange(next)
          }}
        />
      )

    // `text` and `path` both land here.
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
  const settings = useSettings(state => state.settings)
  const setValue = useSettings(state => state.setValue)

  const value = valueAt(settings, descriptor.path)
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
