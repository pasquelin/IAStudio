// SPDX-License-Identifier: MIT
import { useTranslation } from 'react-i18next'
import { inputBindingFits } from '@shared/domain/inputMap'
import type { GamepadBinding, GamepadControl, InputActionKind } from '@shared/domain/inputMap'
import { Button } from '@/components/Button'
import { NumberField } from '@/components/NumberField'
import { SelectField } from '@/components/SelectField'
import { ToggleField } from '@/components/ToggleField'
import { useInputCapture } from '@/hooks/useInputCapture'
import { HINT_LEFT, TIP_LEFT } from '@/helpers/tooltip'
import { useLatest } from '@/hooks/useLatest'
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
  const capture = useInputCapture()
  // The row keeps being edited while a push is waited on: without this, binding the stick would
  // put back the dead zone and the scale the author changed in the meantime.
  const latest = useLatest(binding)
  // A control the ACTION cannot take is not one a capture may bind: a stick pushed while a
  // button action is being captured would otherwise write a binding the map refuses.
  const fits = (control: GamepadControl): boolean =>
    inputBindingFits(kind, { device: 'gamepad', control })

  return (
    <>
      <SelectField
        scId={scId}
        label={t('game.inputMap.binding', { device: t('game.inputMap.device.gamepad') })}
        value={binding.control}
        options={CONTROLS.filter(fits).map(control => ({ value: control, label: control }))}
        onChange={control => onChange({ ...binding, control })}
        actions={
          <Button
            onClick={() =>
              capture.capturing
                ? capture.cancel()
                : capture.captureGamepadControl(
                    control => onChange({ ...latest.current, control }),
                    fits,
                  )
            }
            {...HINT_LEFT(t('game.inputMap.captureHint'))}
          >
            {capture.capturing ? t('game.inputMap.capturing') : t('game.inputMap.capture')}
          </Button>
        }
      />
      <NumberField
        label={t('game.inputMap.deadZone')}
        hint={TIP_LEFT(t('game.inputMap.deadZone'), false, t('game.inputMap.help.deadZone'))}
        value={binding.deadZone ?? DEFAULT_GAMEPAD_DEAD_ZONE}
        min={0}
        max={0.99}
        onChange={deadZone => onChange({ ...binding, deadZone })}
      />
      <ToggleField
        label={t('game.inputMap.invert')}
        hint={TIP_LEFT(t('game.inputMap.invert'), false, t('game.inputMap.help.invert'))}
        value={binding.invert ?? false}
        onChange={invert => onChange({ ...binding, invert })}
      />
      <NumberField
        label={t('game.inputMap.scale')}
        hint={TIP_LEFT(t('game.inputMap.scale'), false, t('game.inputMap.help.scale'))}
        value={binding.scale ?? 1}
        onChange={scale => onChange({ ...binding, scale })}
      />
    </>
  )
}
