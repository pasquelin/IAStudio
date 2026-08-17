import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  bindingOf,
  COMMAND_SCOPES,
  commandsIn,
  conflicts,
  type BindingOverrides,
  type CommandDescriptor,
  type CommandId,
} from '@shared/domain/command'
import type { Signature } from '@shared/domain/shortcut'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settingsDraft'
import { WINDOW_CAPTION } from '@/design/window-styles'
import { ShortcutsSettingsScope } from './ShortcutsSettingsScope'
import { ShortcutsSettingsSearchByChord } from './ShortcutsSettingsSearchByChord'

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
      <ShortcutsSettingsSearchByChord
        query={query}
        listening={listening === 'search'}
        onListen={() => setListening(listening === 'search' ? null : 'search')}
        onQuery={signature => {
          setListening(null)
          setQuery(signature)
        }}
      />

      {COMMAND_SCOPES.map(scope => (
        <ShortcutsSettingsScope
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
        <p className={WINDOW_CAPTION}>{t('settings.chordFree')}</p>
      )}
    </div>
  )
}
