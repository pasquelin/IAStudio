// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WINDOW_CAPTION, WINDOW_GROUP_LABEL, WINDOW_ROW } from '@/components/windowStyles'
import { cn } from '@/helpers/cn'

function connectedGamepads(): Gamepad[] {
  if (typeof navigator.getGamepads !== 'function') return []
  return Array.from(navigator.getGamepads()).filter(
    (gamepad): gamepad is Gamepad => gamepad?.connected === true,
  )
}

export function InputSettings() {
  const { t } = useTranslation()
  const [gamepads, setGamepads] = useState(connectedGamepads)

  useEffect(() => {
    const refresh = (): void => setGamepads(connectedGamepads())
    window.addEventListener('gamepadconnected', refresh)
    window.addEventListener('gamepaddisconnected', refresh)
    return () => {
      window.removeEventListener('gamepadconnected', refresh)
      window.removeEventListener('gamepaddisconnected', refresh)
    }
  }, [])

  return (
    <section className="mt-5" aria-labelledby="input-devices-title">
      <h3 id="input-devices-title" className={WINDOW_GROUP_LABEL}>
        {t('settings.inputDevices.title')}
      </h3>
      <ul className="m-0 list-none p-0">
        <li className={WINDOW_ROW}>{t('settings.inputDevices.keyboard')}</li>
        <li className={WINDOW_ROW}>{t('settings.inputDevices.mouse')}</li>
        {gamepads.map(gamepad => (
          <li key={gamepad.index} className={WINDOW_ROW}>
            {gamepad.id}
          </li>
        ))}
      </ul>
      {gamepads.length === 0 && (
        <p className={cn(WINDOW_CAPTION, 'mt-2')}>{t('settings.inputDevices.noGamepad')}</p>
      )}
    </section>
  )
}
