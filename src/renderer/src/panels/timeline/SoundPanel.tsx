import { sequenceStore, useSequences } from '@/stores/sequences'
import { MontagePanel } from './MontagePanel'

export type SoundPanelProps = { documentId: string }

/**
 * The sound montage of a take: the same montage the Video workspace shows, with sound only.
 *
 * It installs nothing itself, and waits instead. `document-io` is what fills a document — from
 * the file when there is one, from `EMPTY_SOUND_SEQUENCE` when there is not — and a panel posting
 * its own default beside it would be a second owner of the same state: the montage would be
 * usable while the file was still in flight, and the read landing after would replace whatever
 * had just been dropped on it, marking the document clean over an edit nobody could undo.
 */
export function SoundPanel({ documentId }: SoundPanelProps) {
  const ready = useSequences(state => sequenceStore.hasState(state, documentId))

  // Nothing rather than the wrong thing: the montage store answers with the SEQUENCE default —
  // a picture track — until the document is installed, in a workspace that has no picture.
  if (!ready) return null

  // History off, and it is the whole reason the host passes it down: the take under this montage
  // already answers ⌘Z on the `audio` scope, and two listeners undoing at once would take a step
  // off both halves. `AudioDocument` routes the key. Every other key of the strip stays live.
  return <MontagePanel documentId={documentId} history={false} />
}
