import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClipSource } from '@shared/domain/scene'
import { Button } from '../Button'
import { Flyout } from '../Flyout'
import { chipSkin } from '../styles'
import { AnimationPickerAi } from './AnimationPickerAi'
import { AnimationPickerImport } from './AnimationPickerImport'
import { AnimationPickerLibrary } from './AnimationPickerLibrary'
import { AnimationPickerMapping } from './AnimationPickerMapping'
import { AnimationPickerPreview } from './AnimationPickerPreview'

/** The three places a motion can come from. Their order is the one the issue lists them in. */
export type AnimationPickerSource = 'library' | 'import' | 'ai'

const SOURCES: readonly AnimationPickerSource[] = ['library', 'import', 'ai']

export type AnimationPickerProps = {
  documentId: string
  nodeId: string
  /** What it hangs off — the « add an animation » button of the inspector. */
  anchor: HTMLElement | null
  /** The block laid while browsing, so the preview and the fit both speak of the same thing. */
  laid: { clipId: string; source: ClipSource } | null
  /** Lays one, replacing whatever was being looked at. */
  onChoose: (source: ClipSource, label: string) => void
  /** Keeps what is laid, or takes it back — the two ways out, and there are no others. */
  onKeep: () => void
  onDismiss: () => void
}

/**
 * Where an animation is chosen: the project's own, a file from disk, or a Scenario model.
 *
 * The preview is NOT a rehearsal — choosing lays the real block on the real character and plays
 * it through the real retargeting, which is what the issue demands in as many words: an preview
 * that differs from the result is a defect rather than an approximation. `Annuler` takes it back.
 *
 * A flyout off the button rather than a window of its own, and that is the whole reason: a
 * separate window has no viewport, so it could only ever show a rehearsal.
 */
export function AnimationPicker({
  documentId,
  nodeId,
  anchor,
  laid,
  onChoose,
  onKeep,
  onDismiss,
}: AnimationPickerProps) {
  const { t } = useTranslation()
  const [source, setSource] = useState<AnimationPickerSource>('library')

  const panes: Record<AnimationPickerSource, ReactNode> = {
    library: <AnimationPickerLibrary documentId={documentId} nodeId={nodeId} onChoose={onChoose} />,
    import: <AnimationPickerImport onChoose={onChoose} />,
    ai: <AnimationPickerAi />,
  }

  return (
    <Flyout anchor={anchor} placement="under" onDismiss={onDismiss}>
      <div className="flex w-80 flex-col gap-2 p-2">
        <div role="tablist" aria-label={t('inspector.addAnimation')} className="flex gap-2">
          {SOURCES.map(candidate => (
            <button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={candidate === source}
              className={chipSkin(candidate === source)}
              onClick={() => setSource(candidate)}
            >
              {t(`inspector.animationSource_${candidate}`)}
            </button>
          ))}
        </div>

        <div className="max-h-64 min-h-0 overflow-y-auto">{panes[source]}</div>

        {laid && (
          <>
            <AnimationPickerPreview documentId={documentId} nodeId={nodeId} clipId={laid.clipId} />
            <AnimationPickerMapping documentId={documentId} nodeId={nodeId} source={laid.source} />
            <div className="flex justify-end gap-2">
              <Button onClick={onDismiss}>{t('inspector.animationCancel')}</Button>
              <Button variant="primary" onClick={onKeep}>
                {t('inspector.animationKeep')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Flyout>
  )
}
