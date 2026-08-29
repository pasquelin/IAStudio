import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CHOICE_SCOPES,
  writeScopeFor,
  type AiOverview,
  type ChoiceScope,
  type InstallRefusal,
  type LoadRefusal,
  type RoleRow,
} from '@shared/domain/aiOverview'
import { isGenerationRole, partsOfRole } from '@shared/domain/aiRole'
import type { ModelFamily } from '@shared/domain/model'
import {
  WINDOW_ACTION,
  WINDOW_CAPTION,
  WINDOW_GROUP_LABEL,
  WINDOW_HELP,
} from '@/design/windowStyles'
import { cn } from '@/helpers/cn'
import { useBytes } from '@/hooks/useBytes'
import { useModelFit } from '@/hooks/useModelFit'
import { machineSummary } from '@/helpers/machineSummary'
import { useAiModels } from '@/stores/aiModels'
import { SettingLine } from '../SettingLine'
import { SETTING_COLUMN, SETTING_SELECT } from '../settingStyles'
import { AiEngineOffer } from './AiEngineOffer'
import { AiOllamaOffer } from './AiOllamaOffer'
import { AiRoleRow } from './AiRoleRow'

const SCOPE_FIELD = 'setting-ai-scope'

/** What is in flight, when it belongs to THIS row — the others then hold their render. */
function heldBy<T extends { modelId: string }>(row: RoleRow, flight: T | null): T | null {
  return flight && row.candidates.some(one => one.model.id === flight.modelId) ? flight : null
}

function loadFailureKey(reason: LoadRefusal['reason']): string {
  switch (reason) {
    case 'beyond-machine':
      return 'aiModels.loadBeyondMachine'
    case 'incomplete':
      return 'aiModels.loadIncomplete'
    case 'network':
      return 'aiModels.loadNetwork'
    case 'failed':
      return 'aiModels.loadFailed'
  }
}

function installFailureKey(reason: InstallRefusal['reason']): string {
  switch (reason) {
    case 'network':
      return 'aiModels.installFailedNetwork'
    case 'checksum':
      return 'aiModels.installFailedChecksum'
    case 'failed':
      return 'aiModels.installFailed'
  }
}

/** Where the choices that apply were written, so reopening the screen lands on that side. */
function scopeOf(overview: AiOverview): ChoiceScope {
  return overview.roles.some(row => writeScopeFor(row, overview.projectPath) === 'project')
    ? 'project'
    : 'app'
}

function rowsOf(roles: readonly RoleRow[], family: ModelFamily | undefined): readonly RoleRow[] {
  if (family === undefined) return roles.filter(row => !isGenerationRole(row.role))
  return roles.filter(row => partsOfRole(row.role)?.family === family)
}

export type AiSettingsProps = {
  /** Absent on the overview: Ollama, the machine, and the roles no space holds. */
  family?: ModelFamily
}

/**
 * The manager: which AI serves which EMPLOYMENT, and what this machine says of each candidate.
 * Three rules from ADR-21 — a default that works, nothing hidden, and the machine decides.
 */
export function AiSettings({ family }: AiSettingsProps) {
  const { t } = useTranslation()
  const bytes = useBytes()
  const overview = useAiModels(state => state.overview)
  const addOwnAiModel = useAiModels(state => state.addOwnAiModel)
  const ownModelFailure = useAiModels(state => state.ownModelFailure)
  // One control for the screen rather than one per row: the question is asked once — "these
  // choices are for what?" — and answered once. Seeded from what the rows say, so somebody whose
  // choices are project-scoped does not reopen on the other side.
  const [scope, setScope] = useState<ChoiceScope | null>(null)

  const fitOf = useModelFit(overview?.machine ?? null)
  const rows = rowsOf(overview?.roles ?? [], family)
  const overviewPane = family === undefined

  // On the machine alone, never on the whole overview: a download re-publishes every four
  // mebibytes and `announceProgress` deliberately keeps this member's reference, which depending
  // on the overview would have thrown away.
  const summary = overview?.machine ?? null
  const machine = useMemo(
    () => (summary === null ? '' : machineSummary(summary, t, bytes)),
    [summary, t, bytes],
  )

  if (overview === null) return <p className={WINDOW_HELP}>{t('aiModels.reading')}</p>

  // Never `project` with no project open: the select is gone then, and every click would be
  // refused by the main process without a word.
  const writesTo = overview.projectPath === null ? 'app' : (scope ?? scopeOf(overview))
  // Announced to every row rather than derived per row: what it says is that the disk is taken,
  // which is true of the whole screen.
  const busy = overview.installing !== null || overview.ollama.progress !== null

  return (
    <div className={SETTING_COLUMN}>
      {overviewPane && <p className={WINDOW_CAPTION}>{machine}</p>}
      {/* The one screen of this window that does not wait for Apply, said rather than discovered:
          the manager owns the write because it re-judges the candidates — see `SettingsWindow`. */}
      <p className={cn(WINDOW_HELP, 'mb-4')}>{t('aiModels.appliesNow')}</p>

      {overviewPane && (
        <section className="mb-6">
          <h3 className={cn(WINDOW_GROUP_LABEL, 'mb-2')}>{t('aiModels.sourceOllama')}</h3>
          <p className={WINDOW_CAPTION}>{t('aiModels.sourceOllamaHelp')}</p>
          <AiOllamaOffer offer={overview.ollama} busy={busy} />
        </section>
      )}

      {overviewPane && (
        <section className="mb-6">
          <h3 className={cn(WINDOW_GROUP_LABEL, 'mb-2')}>{t('aiModels.sourceEngine')}</h3>
          <p className={WINDOW_CAPTION}>{t('aiModels.sourceEngineHelp')}</p>
          <AiEngineOffer offer={overview.engine} busy={busy} />
        </section>
      )}

      {overview.projectPath !== null && (
        <SettingLine title={t('aiModels.scope')} labelFor={SCOPE_FIELD}>
          <select
            id={SCOPE_FIELD}
            data-sc="field:ai.scope"
            className={SETTING_SELECT}
            value={writesTo}
            onChange={event => setScope(event.target.value === 'project' ? 'project' : 'app')}
          >
            {CHOICE_SCOPES.map(value => (
              <option key={value} value={value}>
                {t(`aiModels.scope_${value}`)}
              </option>
            ))}
          </select>
        </SettingLine>
      )}

      {rows.length === 0 && <p className={WINDOW_HELP}>{t('aiModels.empty')}</p>}

      {overview.installFailure !== null && (
        <p className={cn(WINDOW_HELP, 'mb-2')} role="status">
          {t(installFailureKey(overview.installFailure.reason))}
        </p>
      )}

      {/* One sentence per branch: only the admission weighed bytes, so only it may name them. */}
      {overview.loadFailure !== null && (
        <p className={cn(WINDOW_HELP, 'mb-2')} role="status">
          {overview.loadFailure.reason === 'beyond-machine'
            ? t('aiModels.loadBeyondMachine', {
                needed: bytes(overview.loadFailure.neededBytes),
                available: bytes(overview.loadFailure.availableBytes),
              })
            : t(loadFailureKey(overview.loadFailure.reason))}
        </p>
      )}

      {rows.map(row => (
        <AiRoleRow
          key={row.role}
          row={row}
          // Only the row that owns it: the others then hold their render while a bar moves.
          loading={heldBy(row, overview.loading)}
          installing={heldBy(row, overview.installing)}
          busy={busy}
          scope={writesTo}
          fitOf={fitOf}
        />
      ))}

      {overviewPane && (
        <>
          <SettingLine title={t('aiModels.ownModel')} help={t('aiModels.ownModelHelp')}>
            <button
              type="button"
              data-sc="field:ai.ownModel"
              className={WINDOW_ACTION}
              onClick={() => void addOwnAiModel()}
            >
              {t('aiModels.addOwnModel')}
            </button>
          </SettingLine>
          {ownModelFailure !== null && (
            <p className={WINDOW_HELP} role="status">
              {t('aiModels.ownModelUnreadable')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
