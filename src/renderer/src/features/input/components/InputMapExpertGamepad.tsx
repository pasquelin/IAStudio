// SPDX-License-Identifier: MIT
import { useTranslation } from 'react-i18next'
import { inputBindingFits } from '@shared/domain/inputMap'
import type { GamepadBinding, GamepadControl, InputActionKind } from '@shared/domain/inputMap'
import { NumberField } from '@/components/NumberField'
import { SelectField } from '@/components/SelectField'
import { ToggleField } from '@/components/ToggleField'
import { DEFAULT_GAMEPAD_DEAD_ZONE } from '@game/runtime/inputMaps'

type InputMapExpertGamepadProps = {
  kind: InputActionKind
  binding: GamepadBinding
  scId: string
  onChange: (binding: GamepadBinding) => void
}

const CONTROLS: readonly GamepadControl[] = [
  'leftStick',
  'rightStick',
  'leftStickX',
  'leftStickY',
  'rightStickX',
  'rightStickY',
  'south',
  'east',
  'west',
  'north',
  'leftShoulder',
  'rightShoulder',
  'leftTrigger',
  'rightTrigger',
  'select',
  'start',
  'leftStickButton',
  'rightStickButton',
  'dpadUp',
  'dpadDown',
  'dpadLeft',
  'dpadRight',
  'home',
]

export function InputMapExpertGamepad({
  kind,
  binding,
  scId,
  onChange,
}: InputMapExpertGamepadProps) {
  const { t } = useTranslation()
  return (
    <>
      <SelectField
        scId={scId}
        label={t('game.inputMap.binding', { device: t('game.inputMap.device.gamepad') })}
        value={binding.control}
        options={CONTROLS.filter(control =>
          inputBindingFits(kind, { device: 'gamepad', control }),
        ).map(control => ({ value: control, label: control }))}
        onChange={control => onChange({ ...binding, control })}
      />
      <NumberField
        label={t('game.inputMap.deadZone')}
        value={binding.deadZone ?? DEFAULT_GAMEPAD_DEAD_ZONE}
        min={0}
        max={0.99}
        onChange={deadZone => onChange({ ...binding, deadZone })}
      />
      <ToggleField
        label={t('game.inputMap.invert')}
        value={binding.invert ?? false}
        onChange={invert => onChange({ ...binding, invert })}
      />
      <NumberField
        label={t('game.inputMap.scale')}
        value={binding.scale ?? 1}
        onChange={scale => onChange({ ...binding, scale })}
      />
    </>
  )
}
