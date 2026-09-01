import { mdiAlertCircleOutline, mdiPlay, mdiStop } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/components/ToolButton'
import { tipFor } from '@/helpers/tooltip'
import { openScriptAt } from '@/helpers/openScript'
import { playReportOf, usePlay } from '@/stores/play'

export type SceneSnapPlayProps = {
  documentId: string
  /**
   * What the keyboard and the pointer are read off while the game runs. A GETTER, called when the
   * button is pressed: the host is a ref, and a ref read during a render is a stale value.
   */
  viewport: () => HTMLElement | null
}

/**
 * The transport that starts a game, on the viewport's own bar rather than in a box of its own —
 * 🛑 that box sat at the toolbars' own coordinates, covered whole, and no click reached Play.
 */
export function SceneSnapPlay({ documentId, viewport }: SceneSnapPlayProps) {
  const { t } = useTranslation()
  const report = usePlay(state => playReportOf(state, documentId))
  // Both, never one OR the other: a game that has a script fault and an engine error has two
  // things wrong with it, and showing the first count hid the second.
  const faults = [
    ...report.errors.map(one => `${one.script}:${one.line} — ${one.message}`),
    ...report.logs.filter(entry => entry.level === 'error').map(entry => entry.message),
  ]
  // The last one an editor can OPEN. A log line names no line, so it opens nothing.
  const addressable = report.errors.findLast(one => one.line > 0) ?? null

  const play = (): void => {
    if (report.state === 'paused') {
      usePlay.getState().resume(documentId)
      return
    }

    const host = viewport()
    // No viewport, no game: the runtime draws through the engine that viewport owns.
    if (host) usePlay.getState().start(documentId, host)
  }

  return (
    <>
      <ToolButton
        icon={mdiPlay}
        tone="success"
        label={t('game.play.start')}
        description={t('game.play.startHint')}
        tooltip={tipFor('horizontal')}
        disabled={report.state === 'playing'}
        onClick={play}
      />

      <ToolButton
        icon={mdiStop}
        tone="danger"
        label={t('game.play.stop')}
        description={t('game.play.stopHint')}
        tooltip={tipFor('horizontal')}
        disabled={report.state === 'edit'}
        onClick={() => usePlay.getState().stop(documentId)}
      />

      {/* A system or a handler that threw is reported and the tick carries on, so without a sign
          here the game would simply appear to do nothing. Warning rather than danger: the red of
          this bar is Stop, and a second red beside it would read as a second way to end the game. */}
      {faults.length > 0 && (
        <ToolButton
          icon={mdiAlertCircleOutline}
          tone="warning"
          label={t('game.play.faults', { count: faults.length })}
          description={faults.at(-1)}
          tooltip={tipFor('horizontal')}
          disabled={!addressable}
          onClick={() => {
            if (!addressable) return
            // Paused first: a game still running scrolls its own errors past the reader.
            usePlay.getState().pause(documentId)
            // Opens the script's own tab, which is what brings the Code space up with it: the
            // section follows the document in front — see `DocumentArea.followFront`.
            openScriptAt(addressable.script, addressable.line, addressable.column || 1)
          }}
        />
      )}
    </>
  )
}
