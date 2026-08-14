import { useEffect } from 'react'
import { EMPTY_SOUND_SEQUENCE } from '@/engines/timeline/timeline-state'
import { sequenceStore, useSequences } from '@/stores/sequences'
import { MontagePanel } from './MontagePanel'

export type SoundPanelProps = { documentId: string }

/**
 * The sound montage of a take: the same montage the Video workspace shows, with sound only.
 *
 * It installs its own starting state rather than leaning on `document-io`: the panel and the
 * document mount together, and the montage store answers with the SEQUENCE default until one of
 * them has written — which would show a picture track, for one frame, in a workspace that has no
 * picture. Idempotent, so the document's own load still wins.
 */
export function SoundPanel({ documentId }: SoundPanelProps) {
  const ready = useSequences(state => sequenceStore.hasState(state, documentId))

  useEffect(() => {
    useSequences.getState().ensure(documentId, () => EMPTY_SOUND_SEQUENCE)
  }, [documentId])

  // Nothing rather than the wrong thing, for the one frame the effect above has not run in.
  if (!ready) return null

  return <MontagePanel documentId={documentId} />
}
