import { mdiMicrophone, mdiMicrophoneOff } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import type { TooltipFactory } from '@/helpers/tooltip'
import { useDictation } from '@/hooks/useDictation'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { useBinding } from '@/stores/bindings'
import { LevelMeter } from './LevelMeter'

export type DictationButtonProps = {
  /** `header` for a bar of panel actions, `row` for the foot of a field — see `ToolButton`. */
  variant?: 'bar' | 'header' | 'row'
  /** Tooltip factory of the host, as for any other button of a dock. */
  tooltip: TooltipFactory
}

/**
 * The microphone, and the level while it listens.
 *
 * Nothing else: what the model still needs, what the system refused and what went wrong belong
 * to the whole application rather than to one field — the status line carries them, the way it
 * carries an update waiting to be installed. A form with two long text fields would otherwise
 * offer two buttons to download the same 640 MB.
 *
 * Built on `ToolButton` like every other button in a dock — the accented state it already has
 * is exactly "this tool is in use", which is what a live microphone is.
 */
export function DictationButton({ variant = 'bar', tooltip }: DictationButtonProps) {
  const { t } = useTranslation()
  const label = useShortcutLabel()
  const shortcut = label(useBinding('app.dictate'))
  const dictation = useDictation()

  // Hidden rather than disabled: a control that is off in the settings has nothing to say, and
  // a greyed microphone beside every prompt would be a permanent question.
  if (!dictation.enabled) return null

  return (
    <span className="flex items-center gap-2">
      {/* Before the button, not after: what follows the microphone is the edge of whatever holds
          it — the foot of a field, the send button — and a meter wedged in there pushed the one
          control of the pair away from that edge.

          Named here, where the button beside it says "stop dictating" rather than that anything
          is being heard. The status line's copy is decorative — its own phrase says it. */}
      {dictation.isListening && <LevelMeter label={t('dictation.listening')} />}
      {dictation.state === 'loadingEngine' && (
        <span className="text-muted text-tiny">{t('dictation.loadingEngine')}</span>
      )}

      <ToolButton
        icon={dictation.isListening ? mdiMicrophone : mdiMicrophoneOff}
        label={dictation.isListening ? t('dictation.stop') : t('dictation.start')}
        tooltip={tooltip}
        shortcut={shortcut}
        variant={variant}
        accented={dictation.isListening}
        disabled={dictation.state === 'loadingEngine' || dictation.state === 'downloadingModel'}
        onClick={() => void (dictation.isListening ? dictation.stop() : dictation.start())}
      />
    </span>
  )
}
