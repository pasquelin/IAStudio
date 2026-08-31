import { useTranslation } from 'react-i18next'
import type { AiOverview } from '@shared/domain/aiOverview'
import type { SettingsSectionId } from '@shared/domain/settings'
import { Button } from '@/components/Button'
import { HOME_BLOCK, HOME_BLOCK_HEADING, ROW_QUIET } from '@/components/styles'
import { AI_SECTION } from '@/helpers/aiSectionLazy'
import { cn } from '@/helpers/cn'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useBytes } from '@/hooks/useBytes'
import { coverageOf } from './inventory'

/** Three lines. A ranking longer than that is a catalogue, and the catalogue has a screen. */
const SHOWN = 3

/**
 * What ONE download buys, most first — the reading the manager cannot give at a glance.
 *
 * Twenty-five models answer nineteen employments and the difference between them is not the
 * quality: SSD-1B serves six for 4.47 GB where Mochi serves one for 133. The families a model
 * spans are what make it transverse, so they are named rather than counted.
 */
export function ModelInventoryCoverage({
  overview,
  onOpen,
}: {
  overview: AiOverview
  onOpen: (section: SettingsSectionId) => void
}) {
  const { t } = useTranslation()
  const bytes = useBytes()

  const rows = coverageOf(overview, SHOWN)
  if (rows.length === 0) return null

  return (
    <div className={HOME_BLOCK}>
      <h3 className={HOME_BLOCK_HEADING}>{t('home.models.coverage')}</h3>

      {rows.map(row => (
        <div key={row.id} className="flex items-center gap-3 px-2 py-1">
          <span className="text-text w-40 shrink-0 truncate text-xs">{row.name}</span>
          <span className={cn(ROW_QUIET, 'text-tiny min-w-0 flex-1 truncate')}>
            {row.families.map(family => t(`families.${family}`)).join(' · ')}
          </span>
          <span className={cn(ROW_QUIET, 'text-tiny shrink-0')}>
            {t('aiModels.servesRoles', { count: row.employments })} · {bytes(row.diskBytes)}
          </span>

          <span className="flex w-28 shrink-0 justify-end">
            {row.installed || !row.usable ? (
              // What this machine cannot hold is greyed rather than dropped: hiding it makes the
              // catalogue look smaller than it is.
              <span className={cn(ROW_QUIET, 'text-tiny')}>
                {t(row.installed ? 'home.models.held' : 'home.models.beyond')}
              </span>
            ) : (
              <Button {...HINT_LEFT(t('home.models.localHint'))} onClick={() => onOpen(AI_SECTION)}>
                {t('aiModels.install')}
              </Button>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
