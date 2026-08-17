import type { SettingValue } from '@shared/domain/settings-path'
import { useToken } from '@/hooks/useToken'
import type { Labelled } from './controls'

/**
 * A colour, shown as the one currently in effect. An unset accent is not blank — it is whatever
 * the theme declares, so that is what the swatch has to display, and `useToken` keeps it in step
 * when the theme moves underneath.
 */
export function SettingRowColorControl({
  id,
  describedBy,
  value,
  onChange,
}: Labelled & { value: SettingValue | undefined; onChange: (value: SettingValue) => void }) {
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
