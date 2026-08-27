import { mdiPause, mdiPlay, mdiStop } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { VIEWPORT_READOUT } from '@/design/styles'
import { ToolButton } from '@/design/ToolButton'
import { cn } from '@/helpers/cn'
import { formatDecimal } from '@/helpers/format'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useCode } from '@/stores/code'
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
  // Both, never one OR the other: a game that has a script fault and an engine error has two
  // things wrong with it, and showing the first count hid the second.
  const faults = [
    ...report.errors.map(one => `${one.script}:${one.line} — ${one.message}`),
    ...report.logs.filter(entry => entry.level === 'error').map(entry => entry.message),
  ]
  // The last one an editor can OPEN. A log line names no line, so it opens nothing.
  const addressable = report.errors.findLast(one => one.line > 0) ?? null

  const play = (): void => {
    if (report.state === 'paused') return usePlay.getState().resume(documentId)

    const host = viewport()
    // No viewport, no game: the runtime draws through the engine that viewport owns.
    if (host) usePlay.getState().start(documentId, host)
  }

  return (
    <div
      className={cn(
        VIEWPORT_READOUT,
        // 🛑 `VIEWPORT_READOUT` turns pointer events OFF — a drag has to reach the viewport
        // through it, and the two other readouts are words nobody clicks. This one is a
        // transport, so it catches the pointer back, exactly as `CANVAS_TRIGGER` does.
        'pointer-events-auto top-2 left-2 flex items-center gap-2 tabular-nums',
      )}
    >
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
          {t('game.play.objects', { count: report.entities })}
          {' · '}
          {t('game.play.readout', {
            fps: formatDecimal(report.fps, i18n.language, { digits: 0 }),
            tick: report.tick,
          })}
        </span>
      )}

      {/* A system or a handler that threw is reported and the tick carries on, so without a word
          here the game would simply appear to do nothing. The last one is named in full.

          🛑 A BUTTON when the last fault is addressable: `RuntimeError` carries the script, the
          line and the column, which is the same datum an editor opens on. */}
      {faults.length > 0 &&
        (addressable ? (
          <button
            type="button"
            className="text-warning underline decoration-dotted"
            data-sc="field:play.faults"
            title={t('game.play.openFault')}
            onClick={() => {
              // Paused first: a game still running would scroll its own errors past the reader.
              usePlay.getState().pause(documentId)
              useCode
                .getState()
                .openAt(addressable.script, addressable.line, addressable.column || 1)
            }}
          >
            {t('game.play.faults', { count: faults.length })}
          </button>
        ) : (
          <span className="text-warning" title={faults.at(-1)}>
            {t('game.play.faults', { count: faults.length })}
          </span>
        ))}
    </div>
  )
}
