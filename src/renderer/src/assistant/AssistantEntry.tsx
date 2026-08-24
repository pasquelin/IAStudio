import { mdiChatOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { TITLE_BAR_TRIGGER } from '@/design/styles'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { HINT_BOTTOM, withShortcut } from '@/helpers/tooltip'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { useAssistant } from '@/stores/assistant'
import { useBinding } from '@/stores/bindings'

/**
 * The way to the assistant with a pointer.
 *
 * It exists because there was none: the window opened on ⌘K and nothing on screen said so, which
 * left the one surface built to be talked to as the only one that never offered it.
 *
 * Named rather than icon-only, and that is what decides its chrome: `ToolButton` sets an
 * `aria-label` on everything it renders, and one set over a visible word REPLACES that word for a
 * screen reader (WCAG 2.5.3) — the button would then answer to a name nobody can see. So it wears
 * `TITLE_BAR_TRIGGER`, the shape `TitleBarSelect` wears at the other end of the bar, and explains
 * itself with a hint instead of a naming tooltip.
 */
export function AssistantEntry() {
  const { t } = useTranslation()
  const label = useShortcutLabel()
  const binding = useBinding('app.assistant')
  const staged = useAssistant(state => state.staged)
  const open = useAssistant(state => state.open)

  // A surface other than the modal already holds the thread — the empty centre. Offering a second
  // way in beside a field that is right there reads as two assistants where there is one.
  //
  // Quiet for being REDUNDANT, not forbidden: the chord still opens the modal, which is the only
  // host that claims the spoken word. It rides in the hint rather than being dropped.
  const disabled = staged > 0 && !open

  return (
    <button
      type="button"
      {...HINT_BOTTOM(
        withShortcut(
          disabled ? t('assistant.stagedHint') : t('assistant.writeHint'),
          label(binding),
        ),
      )}
      // Announced rather than written beside the word: the chord is the half of this nobody can
      // guess, and spelling it out would put a second reading in a bar of one-word destinations.
      aria-keyshortcuts={binding ?? undefined}
      // `aria-disabled`, not `disabled`: a button removed from reach is a button whose hint
      // nobody can read, and the hint is the only thing on screen saying why it is quiet.
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : () => useAssistant.getState().show()}
      className={cn(
        TITLE_BAR_TRIGGER,
        disabled && 'hover:text-muted cursor-default opacity-40 hover:bg-transparent',
      )}
    >
      <UiIcon path={mdiChatOutline} size={14} />
      {t('assistant.title')}
    </button>
  )
}
