import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LOCAL_RUNTIME, type ModelSummary } from '@shared/domain/model'
import type { ModelRefusalWord } from '@/hooks/useModelReach'
import { cn } from '@/helpers/cn'
import { fieldHandle } from '../scHandle'
import { Chip } from '../Chip'
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
  refusalOf?: (model: ModelSummary) => ModelRefusalWord | undefined
  /** What the closed control says under the name — where it runs, whether it is installed. */
  caption?: string
  /**
   * What the model in use is called when it is not in the page the picker holds. A control whose
   * value matches no row draws blank, which reads as a panel that lost its model.
   */
  valueLabel?: string
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
 * The model in use, changed without leaving the panel. A flyout rather than a surface of its own:
 * choosing a model is a step of a generation, not a destination — managing them is the settings'.
 */
export function ModelPicker({
  models,
  value,
  onChange,
  refusalOf,
  caption,
  valueLabel,
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
        <span className="text-text truncate text-xs">
          {chosen?.name ?? valueLabel ?? emptyLabel}
        </span>
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
                <Chip
                  key={one}
                  label={t(`generation.modelScope_${one}`)}
                  hint={t('generation.modelScopeHint')}
                  selected={scope === one}
                  data-sc={fieldHandle(`generation.modelScope.${one}`)}
                  onClick={() => setScope(one)}
                />
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
