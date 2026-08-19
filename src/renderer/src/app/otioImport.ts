import i18next from 'i18next'
import { workspaceForKind } from '@shared/domain/document'
import { importSourceOf, lossesImportingFrom } from '@shared/domain/importRegistry'
import { stemOf } from '@shared/domain/fileName'
import type { MontageImportResult } from '@shared/ipc'
import { montageHoldsMore, sequenceFromOtio } from '@/engines/timeline/otioTimeline'
import type { SequenceState } from '@/engines/timeline/timelineState'
import { getBridge } from '@/services/bridge'
import { reportFailure, reportNotice } from '@/services/diagnostics'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { runTask } from '@/stores/tasks'
import { sequenceStore } from '@/stores/sequences'
import { openDocument } from './dockviewApi'
import { saveDocument } from './documentIo'

/**
 * What a bundle read here does NOT bring, said once per import.
 *
 * From the registry rather than from the file: this is the structural half — a montage written by
 * another application carries the standard part and nothing else, whatever any particular file
 * happens to hold. `montageHoldsMore` says the other half, which IS per file.
 */
function sayWhatIsNotRebuilt(): void {
  const losses = lossesImportingFrom('montage.otioz')
  if (losses.length === 0) return

  // The trait names as they are, which is what the flatten refusal already writes: nothing in
  // this repo translates them, and inventing nineteen labels here would be the first surface to.
  reportNotice('document.load', i18next.t('documents.importLoses', { parts: losses.join(', ') }))
}

/**
 * The cut, relinked to the rows the media were given on the way in.
 *
 * Keyed by the ENTRY, which is what the bundle rewrote every `target_url` to. A clip naming a
 * medium that got no row — one the studio has no editor for — resolves to nothing and is dropped
 * by the reader, which is the honest answer for a rush it could not open anyway.
 */
export function sequenceOfBundle({ content, media }: MontageImportResult): SequenceState {
  const byEntry = new Map(media.map(one => [one.entry, one.assetId]))
  const payload: unknown = JSON.parse(content)

  const beyond = montageHoldsMore(payload)
  if (beyond.length > 0) {
    reportNotice(
      'document.load',
      i18next.t('documents.montageHoldsMore', { parts: beyond.join(', ') }),
    )
  }

  // `link`: the ids a bundle carries were minted by another catalogue, and trusting them would
  // point every clip at a row this project has never held.
  return sequenceFromOtio(payload, url => byEntry.get(url) ?? '', 'link')
}

/**
 * Reads a montage bundle into the project and opens it.
 *
 * Answers the new document's id, or `null` when the picker was dismissed, no project is open, or
 * the read was stopped. What the file says WINS: the cut is the file's, and every medium is
 * copied in and catalogued rather than pointed at where it happened to lie.
 */
export async function importOtioz(): Promise<string | null> {
  const bridge = getBridge()
  if (!bridge) return null

  const workspace = workspaceForKind(importSourceOf('montage.otioz').kind)
  if (!workspace) return null

  try {
    const read = await runTask(i18next.t('documents.importing'), id => bridge.montage.import(id))
    if (!read) return null

    // The rows were minted by the main process while it unpacked; nothing in the window has seen
    // them yet, and the montage is about to name every one of them.
    await useAssets.getState().refresh()

    sayWhatIsNotRebuilt()
    const state = sequenceOfBundle(read)

    const created = await useDocuments
      .getState()
      .create(workspace, { title: stemOf(read.folder), folder: read.folder })
    if (!created) return null

    sequenceStore.use.getState().replace(created.id, state)
    openDocument(created)
    // Written at once rather than left dirty: an import that only exists in memory is one a
    // crash loses, and the person has nothing to undo back to.
    await saveDocument(created.id, false)

    return created.id
  } catch (error) {
    reportFailure('sequence.import', 'montage.otioz', error)
    return null
  }
}
