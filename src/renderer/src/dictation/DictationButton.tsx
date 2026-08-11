import { mdiMicrophone, mdiMicrophoneOff } from '@mdi/js'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { cn } from '@/helpers/cn'
import type { TooltipFactory } from '@/helpers/tooltip'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { useBinding } from '@/stores/bindings'
import { useDictation as useStore } from '@/stores/dictation'
import { useDictation } from './useDictation'

export type DictationButtonProps = {
  /** `header` is the smaller gauge, for a bar of panel actions. */
  variant?: 'bar' | 'header'
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

      {dictation.isListening && <LevelMeter />}
      {dictation.state === 'loadingEngine' && (
        <span className="text-muted text-tiny">{t('dictation.loadingEngine')}</span>
      )}
    </span>
  )
}

/**
 * The level, as five bars that fill from the left.
 *
 * Bars rather than a number: what it is there to answer is "is it hearing me", and a figure
 * makes that a reading exercise.
 *
 * It reads the store itself rather than taking the level as a prop, so ten updates a second
 * re-render these five bars and nothing else — not the button above them, and not the field
 * they sit under. Quantised in the selector, so a level that wobbles without lighting another
 * bar renders nothing at all.
 */
function LevelMeter(): ReactNode {
  const { t } = useTranslation()
  // Compressed, not linear: speech sits low in the range, and a linear meter barely moves.
  const lit = useStore(store => Math.min(5, Math.ceil(Math.sqrt(store.level) * 5)))

  return (
    <span aria-label={t('dictation.listening')} role="img" className="flex items-end gap-0.5">
      {[1, 2, 3, 4, 5].map(bar => (
        <span
          key={bar}
          className={cn(
            'w-0.5 rounded-(--radius-sc-sm) transition-[background-color]',
            bar <= lit ? 'bg-accent' : 'bg-elevated',
          )}
          style={{ height: `${2 + bar * 2}px` }}
        />
      ))}
    </span>
  )
}
