// SPDX-License-Identifier: MIT
import { useTranslation } from 'react-i18next'
import type { InputActionKind, KeyboardBinding } from '@shared/domain/inputMap'
import { NumberField } from '@/components/NumberField'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'

type InputMapExpertKeyboardProps = {
  kind: InputActionKind
  binding: KeyboardBinding
  scId: string
  onChange: (binding: KeyboardBinding) => void
}

export function InputMapExpertKeyboard({
  kind,
  binding,
  scId,
  onChange,
}: InputMapExpertKeyboardProps) {
  const { t } = useTranslation()
  return (
    <>
      <TextField
        scId={scId}
        label={t('game.inputMap.binding', { device: t('game.inputMap.device.keyboard') })}
        value={binding.code}
        onChange={code => onChange({ ...binding, code })}
      />
      {kind === 'axis2' && (
        <SelectField
          scId={`${scId}.axis`}
          label={t('game.inputMap.axis')}
          value={binding.axis ?? 'x'}
          options={[
            { value: 'x', label: 'X' },
            { value: 'y', label: 'Y' },
          ]}
          onChange={axis => onChange({ ...binding, axis })}
        />
      )}
      {kind !== 'button' && (
        <NumberField
          label={t('game.inputMap.scale')}
          value={binding.scale ?? 1}
          onChange={scale => onChange({ ...binding, scale })}
        />
      )}
    </>
  )
}
