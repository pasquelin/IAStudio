import { mdiRobotOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { motionProvidersOf } from '@shared/domain/rigProvider'
import { Row } from '../Row'
import { rigServiceNote } from '@/helpers/rigServiceNote'
import { useFamilyModels } from '@/hooks/useFamilyModels'
import { usePlanAccess } from '@/hooks/usePlanAccess'

/**
 * The Scenario models that MAKE a motion, each with the reason it cannot run when it cannot.
 *
 * Read-only for now, and said out loud rather than hidden: submitting one needs the whole
 * export-upload-job-import chain, which nothing here can verify — every one of them answers 403
 * on this account. What the screen owes the user meanwhile is the reason, before any click.
 */
export function AnimationPickerAi() {
  const { t } = useTranslation()
  const plan = usePlanAccess()
  const providers = motionProvidersOf(useFamilyModels('3d'))

  if (providers.length === 0) {
    return <p className="text-muted text-tiny p-2">{t('inspector.animationAiNone')}</p>
  }

  return (
    <ul>
      {providers.map(provider => (
        <li key={provider.modelId}>
          <Row
            icon={mdiRobotOutline}
            title={provider.name}
            subtitle={rigServiceNote(provider, plan, { bytes: 0 }, t)}
          />
        </li>
      ))}
    </ul>
  )
}
