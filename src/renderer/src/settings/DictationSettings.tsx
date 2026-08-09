import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft, useSettingValue } from '@/stores/settings-draft'

/**
 * The microphone to record from — the one setting no registry descriptor can express, because
 * its options are whatever is plugged in right now.
 *
 * Labels stay empty until the machine has granted access once, which is why the list is asked
 * for again on `devicechange` as well as on opening: a headset plugged in after the first
 * dictation appears named, and one plugged in before it appears named only afterwards.
 */
export function DictationSettings() {
  const { t } = useTranslation()
  const devices = useDictation(state => state.devices)
  const refreshDevices = useDictation(state => state.refreshDevices)
  const enabled = useSettings(state => state.settings.dictation.enabled)
  const stage = useSettingsDraft(state => state.stage)
  // Through the same buffer every other row uses: a choice made here waits for Apply, and
  // Cancel takes it back with the rest.
  const chosen = useSettingValue('dictation.inputDeviceId')

  useEffect(() => {
    if (!enabled) return

    void refreshDevices()
    const onChange = () => void refreshDevices()
    navigator.mediaDevices.addEventListener('devicechange', onChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange)
  }, [enabled, refreshDevices])

  if (!enabled) return null

  return (
    <label className="mt-4 flex flex-col gap-1.5">
      <span className="text-xs font-medium">{t('dictation.device')}</span>

      <select
        className="select select-sm w-full max-w-md"
        value={typeof chosen === 'string' ? chosen : ''}
        onChange={event => stage('dictation.inputDeviceId', event.target.value)}
      >
        {/* Empty rather than absent: the system default is a legitimate answer, and the one
            that survives a headset being unplugged. */}
        <option value="">{t('dictation.defaultDevice')}</option>
        {devices.map(device => (
          <option key={device.id} value={device.id}>
            {device.label || device.id}
          </option>
        ))}
      </select>

      {devices.length === 0 && (
        <span className="text-base-content/60 text-xs">{t('dictation.noDevice')}</span>
      )}
    </label>
  )
}
