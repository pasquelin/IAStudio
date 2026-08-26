import { mdiPause, mdiPlay, mdiStop } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { VIEWPORT_READOUT } from '@/design/styles'
import { ToolButton } from '@/design/ToolButton'
import { cn } from '@/helpers/cn'
import { formatDecimal } from '@/helpers/format'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { playReportOf, usePlay } from '@/stores/play'

export type PlayBarProps = {
  documentId: string
  /**
   * What the keyboard and the pointer are read off while the game runs. A GETTER, called when the
   * button is pressed: the host is a ref, and a ref read during a render is a stale value.
   */
  viewport: () => HTMLElement | null
}

/**
 * Play, pause, stop — and what the game says about itself while it runs.
 *
 * Over the picture rather than in a panel, for the reason `SceneCounters` gives: the figures are
 * read WHILE the game runs, and a panel one has to switch to is a panel nobody consults.
 */
export function PlayBar({ documentId, viewport }: PlayBarProps) {
  const { t, i18n } = useTranslation()
  const report = usePlay(state => playReportOf(state, documentId))
  const running = report.state !== 'edit'
  const faults = report.logs.filter(entry => entry.level === 'error')

  const play = (): void => {
    if (report.state === 'paused') return usePlay.getState().resume(documentId)

    const host = viewport()
    // No viewport, no game: the runtime draws through the engine that viewport owns.
    if (host) usePlay.getState().start(documentId, host)
  }

  return (
    <div className={cn(VIEWPORT_READOUT, 'top-2 left-2 flex items-center gap-2 tabular-nums')}>
      {report.state === 'playing' ? (
        <ToolButton
          icon={mdiPause}
          label={t('game.play.pause')}
          description={t('game.play.pauseHint')}
          tooltip={TIP_BOTTOM}
          onClick={() => usePlay.getState().pause(documentId)}
        />
      ) : (
        <ToolButton
          icon={mdiPlay}
          label={t('game.play.start')}
          description={t('game.play.startHint')}
          tooltip={TIP_BOTTOM}
          onClick={play}
        />
      )}

      <ToolButton
        icon={mdiStop}
        label={t('game.play.stop')}
        description={t('game.play.stopHint')}
        tooltip={TIP_BOTTOM}
        disabled={!running}
        onClick={() => usePlay.getState().stop(documentId)}
      />

      {running && (
        <span aria-live="off">
          {t('game.play.readout', {
            entities: report.entities,
            fps: formatDecimal(report.fps, i18n.language, { digits: 0 }),
            tick: report.tick,
          })}
        </span>
      )}

      {/* A system or a handler that threw is reported and the tick carries on, so without a word
          here the game would simply appear to do nothing. The last one is named in full. */}
      {faults.length > 0 && (
        <span className="text-warning" title={faults.at(-1)?.message}>
          {t('game.play.faults', { count: faults.length })}
        </span>
      )}
    </div>
  )
}
