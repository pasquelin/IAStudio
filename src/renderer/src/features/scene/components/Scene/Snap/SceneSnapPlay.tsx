import { mdiAlertCircleOutline, mdiPlay, mdiStop } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { faultsOf } from '@shared/domain/gameRuntime'
import { ToolButton } from '@/components/ToolButton'
import { tipFor } from '@/helpers/tooltip'
import { openScriptAt } from '@/helpers/openScript'
import { playReportOf, usePlay } from '@/stores/play'

export type SceneSnapPlayProps = { documentId: string }

/**
 * The transport that starts a game, on the viewport's own bar rather than in a box of its own —
 * 🛑 that box sat at the toolbars' own coordinates, covered whole, and no click reached Play.
 */
export function SceneSnapPlay({ documentId }: SceneSnapPlayProps) {
  const { t } = useTranslation()
  const report = usePlay(state => playReportOf(state, documentId))
  const faults = faultsOf(report)
  // The last one an editor can OPEN. A log line names no line, so it opens nothing.
  const addressable = report.errors.findLast(one => one.line > 0) ?? null

  const play = (): void => {
    // The game runs in a window of its own, which reads its own keyboard: nothing of this
    // viewport is handed over, and a resumed game is not a started one.
    if (report.state === 'paused') void usePlay.getState().resume(documentId)
    else usePlay.getState().start(documentId)
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
