import { mdiPause, mdiPlay } from '@mdi/js'
import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { Toolbar } from '@/design/Toolbar'
import { canRedo, canUndo } from '@/engines/core/history'
import type { TimelineEngine } from '@/engines/timeline/TimelineEngine'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { historyOf, useSequences } from '@/stores/sequences'
import { ProgramMonitor } from './ProgramMonitor'
import { TimelineCanvas } from './TimelineCanvas'
import { DEFAULT_VIDEO_TOOL, isVideoTool, VIDEO_TOOLS, type VideoToolId } from './video-tools'

export type SequenceDocumentProps = { documentId: string }

/** Program monitor above, timeline below — the split lives inside the tab, never outside it. */
export function SequenceDocument({ documentId }: SequenceDocumentProps) {
  const { t } = useTranslation()
  const [tool, setTool] = useState<VideoToolId>(DEFAULT_VIDEO_TOOL)
  const [playing, setPlaying] = useState(false)
  const engine = useRef<TimelineEngine | null>(null)

  // Booleans rather than the history itself: a selector building an object on every call hands
  // React a new snapshot each render, and the loop never settles.
  const undoable = useSequences(state => canUndo(historyOf(state, documentId)))
  const redoable = useSequences(state => canRedo(historyOf(state, documentId)))

  const onEngine = useCallback((created: TimelineEngine | null) => {
    engine.current = created
    if (!created) setPlaying(false)
  }, [])

  const toggle = useCallback(() => {
    const current = engine.current
    if (!current) return

    // The engine reports back through `onPlayingChange`, which also fires when another player
    // takes the token and pauses this one from under us.
    if (current.playing()) current.pause()
    else current.play()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== ' ') return
    event.preventDefault()
    toggle()
  }

  return (
    <div className="flex h-full min-h-0 flex-col" onKeyDown={onKeyDown}>
      <div className="bg-chassis relative min-h-0 flex-1">
        <ProgramMonitor documentId={documentId} onEngine={onEngine} onPlayingChange={setPlaying} />
      </div>

      <div className="border-border bg-base relative h-64 shrink-0 border-t">
        <TimelineCanvas documentId={documentId} tool={tool} />

        <Toolbar
          className="absolute top-2 left-2 z-10"
          tools={[...VIDEO_TOOLS]}
          activeTool={tool}
          onTool={id => isVideoTool(id) && setTool(id)}
          extras={
            <ToolButton
              icon={playing ? mdiPause : mdiPlay}
              label={playing ? t('transport.pause') : t('transport.play')}
              tooltip={TIP_RIGHT}
              shortcut="Space"
              onClick={toggle}
            />
          }
          onUndo={() => useSequences.getState().undo(documentId)}
          onRedo={() => useSequences.getState().redo(documentId)}
          canUndo={undoable}
          canRedo={redoable}
        />
      </div>
    </div>
  )
}
