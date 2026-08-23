import { useTranslation } from 'react-i18next'
import type { AiRoleId } from '@shared/domain/aiRole'
import { SelectField } from '@/design/SelectField'
import { HINT_TOP } from '@/helpers/tooltip'
import { roleLabel } from '@/helpers/roleLabel'
import type { CapabilityChoice } from '@/generation/capabilityResolver'

export type GeneratorOperationProps = {
  capability: CapabilityChoice
  onForce: (role: AiRoleId | null) => void
}

/**
 * What the generation is about to do — detected from the workspace, changed by hand when several
 * operations are possible. The § 7 of the brief: nobody has to know what `img2img` means.
 *
 * Not drawn where there is nothing to choose: one reachable operation is a row that only repeats
 * what the panel already says.
 */
export function GeneratorOperation({ capability, onForce }: GeneratorOperationProps) {
  const { t } = useTranslation()
  if (capability.reachable.length < 2) return null

  return (
    <SelectField
      label={t('generation.operation')}
      scId="generation.operation"
      value={capability.chosen}
      options={capability.reachable.map(role => ({
        value: role,
        label: roleLabel(role, t),
      }))}
      onChange={onForce}
      hint={HINT_TOP(t('generation.operationHint'))}
    />
  )
}
