import type { TaskWatch } from '@shared/domain/taskProgress'
import { exportTargetOf } from '@shared/domain/exportRegistry'
import type { ExportedFile, FolderExportRequest } from '@shared/ipc'
import { encodeWav } from '@/engines/audio/wav'
import { stemsOf } from '@/engines/timeline/stems'
import { decodeAsset } from '@/helpers/audioDecode'
import { documentExportName, useDocuments } from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'

/** What a track is called when it was never renamed — a file cannot be named nothing. */
const UNTITLED_TRACK = 'track'

/**
 * A cut's sound, one `.wav` per audible track.
 *
 * The mix is the window's because the CATALOGUE is: only this side resolves a clip's asset, and
 * only a browser decodes an `.m4a`. What the main process gets is bytes it writes.
 */
export async function montageStemsFiles(
  documentId: string,
  watch?: TaskWatch,
): Promise<FolderExportRequest> {
  const name = documentExportName(useDocuments.getState(), documentId, 'edit')

  const stems = await stemsOf(sequenceOf(useSequences.getState(), documentId), decodeAsset, {
    onStep: watch?.onStep,
    signal: watch?.signal,
  })

  if (stems.length === 0) throw new Error('this montage has no audible track to write')

  // Numbered, and the number comes FIRST: two tracks left under the studio's default name are the
  // ordinary case, and a folder holding one `track.wav` is a stem set missing every other row.
  const taken = new Set<string>()
  const files: ExportedFile[] = stems.map((stem, row) => {
    const stub = `${row + 1} ${stem.name.trim() || UNTITLED_TRACK}`
    let file = stub
    for (let twin = 2; taken.has(file); twin += 1) file = `${stub} (${twin})`
    taken.add(file)

    return {
      name: file,
      extension: exportTargetOf('montage.wav').extension,
      bytes: encodeWav(stem.data),
    }
  })

  return { folder: name, target: 'montage.wav', files }
}
