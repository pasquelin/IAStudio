import { mdiAlertCircleOutline, mdiRestore } from '@mdi/js'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  bindingOf,
  COMMAND_SCOPES,
  commandsIn,
  conflicts,
  type BindingOverrides,
  type CommandDescriptor,
  type CommandId,
  type CommandScope,
} from '@shared/domain/command'
import { shortcutLabel, signatureOf, type Signature } from '@shared/domain/shortcut'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settings-draft'

/** Modifiers on their own are not a shortcut; they are what is held while one is pressed. */
const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
])

/**
 * The bindings as they stand, buffer included. Staged like every other setting: a remap is not
 * written until Apply, which is what makes Cancel able to take it back.
 */
function useOverrides(): [BindingOverrides, (next: BindingOverrides) => void] {
  const stored = useSettings(state => state.settings.shortcuts.overrides)
  const staged = useSettingsDraft(state => state.pending.shortcuts?.overrides)
  const stageBranch = useSettingsDraft(state => state.stageBranch)

  return [staged ?? stored, next => stageBranch({ shortcuts: { overrides: next } })]
}

/**
 * Listens for one chord and answers it. Capturing rather than typing a name: nobody knows what
 * `Meta+BracketLeft` is called, and everybody can press it.
 */
function useCapture(onCaptured: (signature: Signature) => void, active: boolean): void {
  useEffect(() => {
    if (!active) return

    const onKeyDown = (event: KeyboardEvent): void => {
      // Captured on the way down and stopped there, so a shortcut being recorded is not also
      // executed by whatever else is listening — `useShortcuts`, or the browser itself.
      event.preventDefault()
      event.stopPropagation()

      if (MODIFIER_CODES.has(event.code)) return
      // Escape leaves without binding: a capture with no way out is a trap.
      if (event.code === 'Escape') return onCaptured('')

      onCaptured(signatureOf(event))
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [active, onCaptured])
}

function CommandRow({
  descriptor,
  overrides,
  clashing,
  capturing,
  onCapture,
  onBind,
}: {
  descriptor: CommandDescriptor
  overrides: BindingOverrides
  clashing: boolean
  capturing: boolean
  onCapture: () => void
  onBind: (signature: Signature | null) => void
}) {
  const { t } = useTranslation()

  useCapture(signature => (signature === '' ? onCapture() : onBind(signature)), capturing)

  const binding = bindingOf(descriptor.id, overrides)
  const remapped = overrides[descriptor.id] !== undefined
  const id = `command-${descriptor.id}`
  const describedBy = `${id}-help`

  return (
    <div className="border-base-300 flex flex-col gap-1 border-b py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium">{t(descriptor.titleKey)}</span>

        <div className="flex shrink-0 items-center gap-1">
          {clashing && (
            <span className="text-error flex" title={t('settings.shortcutConflict')}>
              <UiIcon path={mdiAlertCircleOutline} size={14} />
            </span>
          )}

          <button
            id={id}
            type="button"
            aria-describedby={describedBy}
            aria-label={t(descriptor.titleKey)}
            onClick={onCapture}
            className={cn(
              'btn btn-sm w-40 font-mono',
              capturing && 'btn-primary',
              clashing && !capturing && 'btn-error btn-outline',
            )}
          >
            {capturing ? t('settings.pressAKey') : shortcutLabel(binding) || t('settings.unbound')}
          </button>

          <button
            type="button"
            title={t('settings.restoreDefault')}
            aria-label={`${t('settings.restoreDefault')} — ${t(descriptor.titleKey)}`}
            className="btn btn-ghost btn-xs btn-square"
            disabled={!remapped}
            onClick={() => onBind(null)}
          >
            <UiIcon path={mdiRestore} size={14} className={remapped ? '' : 'opacity-0'} />
          </button>
        </div>
      </div>

      <p id={describedBy} className="text-base-content/60 max-w-lg text-xs">
        {t(descriptor.helpKey)}
      </p>
    </div>
  )
}

/**
 * The shortcuts screen. What no descriptor can express: a binding is captured by pressing it,
 * and a conflict only exists between two commands, never within one.
 *
 * Grouped by scope because that IS the rule: the same key on two surfaces is the design — only
 * one of them is ever listening — and showing them in one flat list would read as a clash.
 */
export function ShortcutsSettings() {
  const { t } = useTranslation()
  const [overrides, setOverrides] = useOverrides()
  /**
   * What is listening, if anything. ONE state rather than one per listener: a row and the
   * search box each holding their own meant a keypress could be recorded as a binding and used
   * as a query at the same time.
   */
  const [listening, setListening] = useState<CommandId | 'search' | null>(null)
  const [query, setQuery] = useState<Signature | null>(null)

  const capturing = listening === 'search' ? null : listening

  // Rebuilt only when a binding moves, not on every keystroke of a capture.
  const clashing = useMemo(() => new Set(conflicts(overrides)), [overrides])

  const bind = (id: CommandId, signature: Signature | null): void => {
    setListening(null)

    const next = { ...overrides }
    // Removed rather than set to the default value: the row then reads as "not remapped", and
    // a future version changing that default reaches this user too.
    if (signature === null) delete next[id]
    else next[id] = signature

    setOverrides(next)
  }

  // The question people actually ask is "what has ⌘K?", not "what is undo bound to".
  const matches = (descriptor: CommandDescriptor): boolean =>
    query === null || bindingOf(descriptor.id, overrides) === query

  return (
    <div className="mt-3 flex flex-col gap-4">
      <SearchByChord
        query={query}
        listening={listening === 'search'}
        onListen={() => setListening(listening === 'search' ? null : 'search')}
        onQuery={signature => {
          setListening(null)
          setQuery(signature)
        }}
      />

      {COMMAND_SCOPES.map(scope => (
        <Scope
          key={scope}
          scope={scope}
          descriptors={commandsIn(scope).filter(matches)}
          overrides={overrides}
          clashing={clashing}
          capturing={capturing}
          onCapture={setListening}
          onBind={bind}
        />
      ))}

      {query !== null && !COMMAND_SCOPES.some(scope => commandsIn(scope).some(matches)) && (
        <p className="text-base-content/60 text-xs">{t('settings.chordFree')}</p>
      )}
    </div>
  )
}

function Scope({
  scope,
  descriptors,
  overrides,
  clashing,
  capturing,
  onCapture,
  onBind,
}: {
  scope: CommandScope
  descriptors: readonly CommandDescriptor[]
  overrides: BindingOverrides
  clashing: ReadonlySet<CommandId>
  capturing: CommandId | null
  onCapture: (id: CommandId | 'search' | null) => void
  onBind: (id: CommandId, signature: Signature | null) => void
}) {
  const { t } = useTranslation()

  if (descriptors.length === 0) return null

  return (
    <section>
      <h3 className="text-base-content/60 mb-1 text-[11px] tracking-wide uppercase">
        {t(`settings.scope.${scope}`)}
      </h3>

      {descriptors.map(descriptor => (
        <CommandRow
          key={descriptor.id}
          descriptor={descriptor}
          overrides={overrides}
          clashing={clashing.has(descriptor.id)}
          capturing={capturing === descriptor.id}
          onCapture={() => onCapture(capturing === descriptor.id ? null : descriptor.id)}
          onBind={signature => onBind(descriptor.id, signature)}
        />
      ))}
    </section>
  )
}

/** Searches by pressing the combination rather than by naming it. */
function SearchByChord({
  query,
  listening,
  onListen,
  onQuery,
}: {
  query: Signature | null
  listening: boolean
  onListen: () => void
  onQuery: (signature: Signature | null) => void
}) {
  const { t } = useTranslation()

  useCapture(signature => onQuery(signature === '' ? null : signature), listening)

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={cn('btn btn-sm font-mono', listening && 'btn-primary')}
        onClick={onListen}
      >
        {listening ? t('settings.pressAKey') : shortcutLabel(query) || t('settings.findByChord')}
      </button>

      {query !== null && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onQuery(null)}>
          {t('settings.showAll')}
        </button>
      )}
    </div>
  )
}
