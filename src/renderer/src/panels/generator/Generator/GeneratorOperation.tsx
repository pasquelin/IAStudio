import { useTranslation } from 'react-i18next'
import type { AiRoleId } from '@shared/domain/aiRole'
import { SelectField } from '@/design/SelectField'
import { HINT_TOP } from '@/helpers/tooltip'
import { roleLabel } from '@/helpers/roleLabel'
import type { CapabilityChoice } from '@/generation/capabilityResolver'

/** What the row reads when the operation follows the workspace rather than a choice. */
const FOLLOW = ''

export type GeneratorOperationProps = {
  capability: CapabilityChoice
  onForce: (role: AiRoleId | null) => void
}

/**
 * What the generation is about to do, detected from the workspace and changed by hand.
 *
 * 🛑 Drawn whenever the operation was FORCED, however few are reachable: an edit arms an
 * upscaler, whose family has one employment, and hiding the row then left the panel pinned to it
 * with no control to leave by.
 */
export function GeneratorOperation({ capability, onForce }: GeneratorOperationProps) {
  const { t } = useTranslation()
  if (capability.reachable.length < 2 && !capability.forced) return null

  const offered = capability.reachable.map(role => ({
    value: String(role),
    label: roleLabel(role, t),
  }))
  // The forced one may belong to another family than the workspace's, so it is not in `reachable`.
  const held = capability.chosen === null ? [] : [String(capability.chosen)]
  const missing = held.filter(role => !offered.some(one => one.value === role))

  return (
    <SelectField
      label={t('generation.operation')}
      layout="stacked"
      scId="generation.operation"
      value={capability.chosen === null ? FOLLOW : String(capability.chosen)}
      options={[
        ...missing.map(role => ({ value: role, label: roleLabel(role as AiRoleId, t) })),
        ...offered,
        // The way back to the workspace, offered only once something is holding the panel away
        // from it — a row that undoes nothing is a row nobody can read.
        ...(capability.forced ? [{ value: FOLLOW, label: t('generation.followSelection') }] : []),
      ]}
      onChange={value => onForce(value === FOLLOW ? null : (value as AiRoleId))}
      hint={HINT_TOP(t('generation.operationHint'))}
    />
  )
}
