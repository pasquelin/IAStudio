import { mdiMicrophone, mdiMicrophoneOff } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { STT_MODEL_BYTES } from '@shared/domain/dictation'
import { Button } from '@/design/Button'
import { ProgressBar } from '@/design/ProgressBar'
import { ToolButton } from '@/design/ToolButton'
import { cn } from '@/helpers/cn'
import { formatBytes } from '@/helpers/format'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { useBinding } from '@/stores/bindings'
import { useDictation, type DictationOptions } from './useDictation'

export type DictationButtonProps = DictationOptions & {
  /** `header` is the smaller gauge, for a bar of panel actions. */
  variant?: 'bar' | 'header'
}

/**
 * The microphone, and everything that can be said about it in one place: the level while it
 * listens, the download the first time, and the refusal when there is one.
 *
 * Built on `ToolButton` like every other button in a dock — the accented state it already has
 * is exactly "this tool is in use", which is what a live microphone is.
 */
export function DictationButton({ variant = 'bar', ...options }: DictationButtonProps) {
  const { t } = useTranslation()
  const label = useShortcutLabel()
  const shortcut = label(useBinding('app.dictate'))
  const dictation = useDictation(options)

  // Hidden rather than disabled: a control that is off in the settings has nothing to say, and
  // a greyed microphone beside every prompt would be a permanent question.
  if (!dictation.enabled) return null

  const downloading = dictation.state === 'downloadingModel'
  const busy = downloading || dictation.state === 'loadingEngine'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ToolButton
          icon={dictation.isListening ? mdiMicrophone : mdiMicrophoneOff}
          label={dictation.isListening ? t('dictation.stop') : t('dictation.start')}
          shortcut={shortcut}
          variant={variant}
          accented={dictation.isListening}
          disabled={busy}
          onClick={() => void (dictation.isListening ? dictation.stop() : dictation.start())}
        />

        {dictation.isListening && <LevelMeter level={dictation.level} />}
        {dictation.state === 'loadingEngine' && (
          <span className="text-muted text-[11px]">{t('dictation.loadingEngine')}</span>
        )}
      </div>

      {dictation.state === 'modelMissing' && (
        <div className="flex flex-col gap-2">
          <p className="text-muted text-[11px]">{t('dictation.modelMissing')}</p>
          <Button onClick={() => void dictation.downloadModel()}>
            {t('dictation.download', {
              size: formatBytes(STT_MODEL_BYTES, unit => t(`units.${unit}`)),
            })}
          </Button>
        </div>
      )}

      {downloading && dictation.download && (
        <div className="flex flex-col gap-2">
          <ProgressBar
            ratio={
              dictation.download.total > 0
                ? dictation.download.received / dictation.download.total
                : 0
            }
            label={t('dictation.downloading', {
              done: formatBytes(dictation.download.received, unit => t(`units.${unit}`)),
              total: formatBytes(dictation.download.total, unit => t(`units.${unit}`)),
            })}
          />
          <Button onClick={() => void dictation.cancelDownload()}>
            {t('dictation.cancelDownload')}
          </Button>
        </div>
      )}

      {dictation.state === 'permissionRequired' && (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-muted text-[11px]">
            {t('dictation.permissionRequired')}
          </p>
          <Button onClick={() => void dictation.openPrivacySettings()}>
            {t('dictation.openPrivacySettings')}
          </Button>
        </div>
      )}

      {dictation.state === 'error' && dictation.failure && (
        <p role="status" className="text-muted text-[11px]">
          {t(`dictation.errors.${dictation.failure.code}`)}
        </p>
      )}
    </div>
  )
}

/**
 * The level, as five bars that fill from the left.
 *
 * Bars rather than a number: what it is there to answer is "is it hearing me", and a figure
 * makes that a reading exercise. Rendered from the store's own level, which updates ten times a
 * second and touches nothing else.
 */
function LevelMeter({ level }: { level: number }) {
  const { t } = useTranslation()
  // Compressed, not linear: speech sits low in the range, and a linear meter barely moves.
  const lit = Math.min(5, Math.ceil(Math.sqrt(level) * 5))

  return (
    <span aria-label={t('dictation.listening')} role="img" className="flex items-end gap-0.5">
      {[1, 2, 3, 4, 5].map(bar => (
        <span
          key={bar}
          className={cn(
            'w-0.5 rounded-(--radius-sc-sm) transition-[height,background-color]',
            bar <= lit ? 'bg-accent' : 'bg-elevated',
          )}
          style={{ height: `${2 + bar * 2}px` }}
        />
      ))}
    </span>
  )
}
