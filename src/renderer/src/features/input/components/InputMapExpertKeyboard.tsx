// SPDX-License-Identifier: MIT
import { useTranslation } from 'react-i18next'
import type { InputActionKind, KeyboardBinding } from '@shared/domain/inputMap'
import { Button } from '@/components/Button'
import { NumberField } from '@/components/NumberField'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { useInputCapture } from '@/hooks/useInputCapture'
import { HINT_LEFT, TIP_LEFT } from '@/helpers/tooltip'
import { useLatest } from '@/hooks/useLatest'

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
  const capture = useInputCapture()
  // Read at the moment the key lands, not at the click: the axis or the scale may have moved.
  const latest = useLatest(binding)
  const label = t('game.inputMap.binding', { device: t('game.inputMap.device.keyboard') })

  return (
    <>
      <TextField
        scId={scId}
        label={label}
        value={binding.code}
        onChange={code => onChange({ ...binding, code })}
        // 🛑 The field stays writable — a `KeyboardEvent.code` no keyboard here can produce is
        // still bindable — but nobody has to know the nomenclature by heart any more.
        actions={
          <Button
            onClick={() =>
              capture.capturing
                ? capture.cancel()
                : capture.captureKey(code => onChange({ ...latest.current, code }))
            }
            {...HINT_LEFT(t('game.inputMap.captureHint'))}
          >
            {capture.capturing ? t('game.inputMap.capturing') : t('game.inputMap.capture')}
          </Button>
        }
      />
      {kind === 'axis2' && (
        <SelectField
          scId={`${scId}.axis`}
          label={t('game.inputMap.axis')}
          hint={TIP_LEFT(t('game.inputMap.axis'), false, t('game.inputMap.help.axis'))}
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
          hint={TIP_LEFT(t('game.inputMap.scale'), false, t('game.inputMap.help.scale'))}
          value={binding.scale ?? 1}
          onChange={scale => onChange({ ...binding, scale })}
        />
      )}
    </>
  )
}
