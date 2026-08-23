import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LOCAL_RUNTIME, type ModelSummary } from '@shared/domain/model'
import { cn } from '@/helpers/cn'
import { fieldHandle } from '../scHandle'
import { Flyout } from '../Flyout'
import { CONTROL, MENU_SURFACE } from '../styles'
import { ModelPickerRow } from './ModelPickerRow'

/** What the list may be narrowed to. `all` is the state it opens in. */
type Scope = 'all' | 'local' | 'cloud' | 'installed'

const SCOPES: readonly Scope[] = ['all', 'local', 'cloud', 'installed']

export type ModelPickerProps = {
  models: readonly ModelSummary[]
  /** The model in use, or `null` when the employment is served by nothing yet. */
  value: string | null
  onChange: (modelId: string) => void
  /** Why a model cannot be picked, per model, in the host's words. */
  refusalOf?: (model: ModelSummary) => string | undefined
  /** What the closed control says under the name — where it runs, whether it is installed. */
  caption?: string
  /** Shown in place of a name when nothing serves the employment yet. */
  emptyLabel: string
}

function within(model: ModelSummary, scope: Scope): boolean {
  if (scope === 'local') return model.runsOn === LOCAL_RUNTIME
  if (scope === 'cloud') return model.runsOn !== LOCAL_RUNTIME
  // A cloud model has nothing to install, and greying it under this facet would say it is missing.
  if (scope === 'installed') return model.installed !== false
  return true
}

/**
 * The model in use, and a way to change it without leaving the panel — the § 15 of the brief.
 *
 * It opens a flyout rather than replacing what is around it: choosing a model is a step of a
 * generation, not a destination. Managing them — installing, removing, reading what they weigh —
 * is the settings' business, and a different question.
 */
export function ModelPicker({
  models,
  value,
  onChange,
  refusalOf,
  caption,
  emptyLabel,
}: ModelPickerProps) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<Scope>('all')

  const shown = useMemo(() => {
    const wanted = search.trim().toLowerCase()
    return models.filter(
      model => within(model, scope) && (!wanted || model.name.toLowerCase().includes(wanted)),
    )
  }, [models, scope, search])

  const chosen = models.find(model => model.id === value)

  return (
    <>
      <button
        type="button"
        ref={setAnchor}
        data-sc={fieldHandle('generation.model')}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(CONTROL, 'flex w-full flex-col items-start justify-center px-2 py-1')}
        onClick={() => setOpen(held => !held)}
      >
        <span className="text-text truncate text-xs">{chosen?.name ?? emptyLabel}</span>
        {caption && <span className="text-muted text-tiny">{caption}</span>}
      </button>

      {open && (
        <Flyout
          anchor={anchor}
          placement="under"
          role="menu"
          onDismiss={() => setOpen(false)}
          onKeyClose={() => setOpen(false)}
        >
          <div className={cn(MENU_SURFACE, 'flex max-h-80 w-full flex-col gap-2 p-2')}>
            <input
              type="search"
              className={cn(CONTROL, 'px-2')}
              data-sc={fieldHandle('generation.modelSearch')}
              placeholder={t('generation.searchModel')}
              aria-label={t('generation.searchModel')}
              value={search}
              onChange={event => setSearch(event.target.value)}
            />

            <div className="flex gap-2" role="group" aria-label={t('generation.modelScope')}>
              {SCOPES.map(one => (
                <button
                  key={one}
                  type="button"
                  data-sc={fieldHandle(`generation.modelScope.${one}`)}
                  aria-pressed={scope === one}
                  className={cn(
                    'text-tiny rounded-(--radius-sc-sm) px-2 py-0.5',
                    scope === one ? 'bg-accent text-accent-ink' : 'bg-surface text-muted',
                  )}
                  onClick={() => setScope(one)}
                >
                  {t(`generation.modelScope_${one}`)}
                </button>
              ))}
            </div>

            <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
              {shown.map(model => (
                <li key={model.id}>
                  <ModelPickerRow
                    model={model}
                    selected={model.id === value}
                    refusal={refusalOf?.(model)}
                    onPick={() => {
                      onChange(model.id)
                      setOpen(false)
                    }}
                  />
                </li>
              ))}
            </ul>

            {shown.length === 0 && (
              <p className="text-muted text-tiny px-2 py-1">{t('collection.noMatch')}</p>
            )}
          </div>
        </Flyout>
      )}
    </>
  )
}
