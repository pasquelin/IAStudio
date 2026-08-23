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
 * What the generation is about to do, detected from the workspace and changed by hand. Not drawn
 * where there is nothing to choose: one operation is a row repeating what the panel already says.
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
