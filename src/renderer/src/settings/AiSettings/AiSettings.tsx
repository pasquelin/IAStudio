import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AiOverview, ChoiceScope, RoleRow } from '@shared/domain/aiOverview'
import { isGenerationRole } from '@shared/domain/aiRole'
import { WINDOW_CAPTION, WINDOW_GROUP_LABEL, WINDOW_HELP } from '@/design/windowStyles'
import { cn } from '@/helpers/cn'
import { useBytes } from '@/hooks/useBytes'
import { useModelFit } from '@/hooks/useModelFit'
import { useAiModels } from '@/stores/aiModels'
import { SettingLine } from '../SettingLine'
import { SETTING_COLUMN, SETTING_SELECT } from '../settingStyles'
import { AiRoleRow } from './AiRoleRow'
import { gpuName } from './gpuName'

const SCOPES: readonly ChoiceScope[] = ['app', 'project']

const SCOPE_FIELD = 'setting-ai-scope'

/** Where the choices that apply were written, so reopening the screen lands on that side. */
function scopeOf(overview: AiOverview): ChoiceScope {
  if (overview.projectPath === null) return 'app'

  return overview.roles.some(row => row.chosen.project !== null) ? 'project' : 'app'
}

/**
 * The manager: which AI serves which EMPLOYMENT, and what this machine says of each candidate.
 * Three rules from ADR-21 — a default that works, nothing hidden, and the machine decides.
 */
export function AiSettings() {
  const { t } = useTranslation()
  const bytes = useBytes()
  const overview = useAiModels(state => state.overview)
  // One control for the screen rather than one per row: the question is asked once — "these
  // choices are for what?" — and answered once. Seeded from what the rows say, so somebody whose
  // choices are project-scoped does not reopen on the other side.
  const [scope, setScope] = useState<ChoiceScope | null>(null)

  const fitOf = useModelFit(overview?.machine ?? null)

  const groups: readonly { heading: string; rows: readonly RoleRow[] }[] = useMemo(() => {
    const roles = overview?.roles ?? []
    return [
      {
        heading: t('aiModels.generationGroup'),
        rows: roles.filter(row => isGenerationRole(row.role)),
      },
      {
        heading: t('aiModels.standaloneGroup'),
        rows: roles.filter(row => !isGenerationRole(row.role)),
      },
    ]
  }, [overview?.roles, t])

  const machine = useMemo(() => {
    if (overview === null) return ''

    return [
      t('aiModels.machineMemory', {
        total: bytes(overview.machine.physicalBytes),
        available: bytes(overview.machine.availableBytes),
      }),
      overview.machine.gpu === null ? null : gpuName(overview.machine.gpu),
      overview.machine.diskFreeBytes === null
        ? null
        : t('aiModels.machineDisk', { free: bytes(overview.machine.diskFreeBytes) }),
    ]
      .filter(part => part !== null)
      .join(' · ')
  }, [overview, t, bytes])

  if (overview === null) return <p className={WINDOW_HELP}>{t('aiModels.reading')}</p>

  // Never `project` with no project open: the select is gone then, and every click would be
  // refused by the main process without a word.
  const writesTo = overview.projectPath === null ? 'app' : (scope ?? scopeOf(overview))
  // Announced to every row rather than derived per row: what it says is that the disk is taken,
  // which is true of the whole screen.
  const busy = overview.installing !== null

  return (
    <div className={SETTING_COLUMN}>
      <p className={cn(WINDOW_CAPTION, 'mb-4')}>{machine}</p>

      {overview.projectPath !== null && (
        <SettingLine title={t('aiModels.scope')} labelFor={SCOPE_FIELD}>
          <select
            id={SCOPE_FIELD}
            data-sc="field:ai.scope"
            className={SETTING_SELECT}
            value={writesTo}
            onChange={event => setScope(event.target.value === 'project' ? 'project' : 'app')}
          >
            {SCOPES.map(value => (
              <option key={value} value={value}>
                {t(`aiModels.scope_${value}`)}
              </option>
            ))}
          </select>
        </SettingLine>
      )}

      {overview.roles.length === 0 && <p className={WINDOW_HELP}>{t('aiModels.empty')}</p>}

      {groups.map(
        group =>
          group.rows.length > 0 && (
            <section key={group.heading} className="mb-4">
              <h3 className={WINDOW_GROUP_LABEL}>{group.heading}</h3>
              {group.rows.map(row => (
                <AiRoleRow
                  key={row.role}
                  row={row}
                  // Only the row that owns it: the others then hold their render while a bar moves.
                  installing={
                    row.candidates.some(one => one.model.id === overview.installing?.modelId)
                      ? overview.installing
                      : null
                  }
                  busy={busy}
                  scope={writesTo}
                  fitOf={fitOf}
                />
              ))}
            </section>
          ),
      )}
    </div>
  )
}
