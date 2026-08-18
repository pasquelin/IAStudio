import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { MontageExportRequest } from '@shared/ipc'
import { clipFixture, sequenceWith, trackFixture } from '@/engines/timeline/timeline-fixtures'
import {
  makeClip,
  reindexTracks,
  SECOND,
  type SequenceState,
} from '@/engines/timeline/timelineState'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { useSequences } from '@/stores/sequences'
import { exportOtio, fileUrlOf, otioExportFiles } from './otioExport'

const RUSH: Asset = {
  id: 'asset-a',
  name: 'Plan large',
  type: 'video',
  location: 'local',
  path: 'assets/vid/plan large.mp4',
  tags: [],
  createdAt: '2026-08-18T10:00:00.000Z',
}

const written = vi.fn<(request: MontageExportRequest) => Promise<string | null>>()

const timelineWritten = () =>
  JSON.parse(new TextDecoder().decode(written.mock.calls[0]?.[0].data ?? new Uint8Array()))

beforeEach(() => {
  written.mockReset()
  written.mockResolvedValue('Bande.otio')
  installFakeBridge({ montage: { export: written } })
  useAssets.setState({ items: [RUSH] })
  useProject.setState({
    project: {
      path: '/Volumes/Travail/Film',
      manifest: {
        version: 1,
        name: 'Film',
        createdAt: '2026-08-18T09:00:00.000Z',
        updatedAt: '2026-08-18T09:00:00.000Z',
      },
    },
    known: true,
  })
})

describe('fileUrlOf', () => {
  it('builds an absolute url, escaping what a path may hold and a url may not', () => {
    expect(fileUrlOf('/Volumes/Travail/Film', 'assets/vid/plan large.mp4')).toBe(
      'file:///Volumes/Travail/Film/assets/vid/plan%20large.mp4',
    )
  })

  // `file://C:/…` would read the drive letter as a host, and resolve to nothing.
  it('keeps a windows drive letter inside the path rather than in the host', () => {
    expect(fileUrlOf('C:\\Films\\Court', 'assets/a.mp4')).toBe(
      'file:///C:/Films/Court/assets/a.mp4',
    )
  })
})

/** A montage in the store under `doc-1`, and the tab that names it « Bande ». */
function laid(state: SequenceState, extra: Record<string, DocumentDescriptor> = {}): void {
  useSequences.setState({ states: { 'doc-1': state }, histories: {} })
  useDocuments.setState({
    documents: {
      'doc-1': {
        id: 'doc-1',
        kind: 'sequence',
        workspace: 'video',
        title: 'Bande',
        path: 'documents/Bande.seq',
      },
      ...extra,
    },
    activeId: 'doc-1',
  })
}

describe('otioExportFiles', () => {
  it('points a clip at the file its asset holds, wherever the project sits', () => {
    laid(sequenceWith(reindexTracks([trackFixture('V1', 'video', [clipFixture('a', 0, SECOND)])])))

    const { folder, files } = otioExportFiles('doc-1')

    expect(folder).toBe('Bande')
    expect(files[0]).toMatchObject({ name: 'Bande', extension: '.otio' })
    expect(
      JSON.parse(new TextDecoder().decode(files[0]?.bytes)).tracks.children[0].children[0]
        .media_reference,
    ).toMatchObject({
      OTIO_SCHEMA: 'ExternalReference.1',
      name: 'Plan large',
      target_url: 'file:///Volumes/Travail/Film/assets/vid/plan%20large.mp4',
    })
  })

  // Thrown rather than answered empty: an outside client has to tell « nothing to export » from
  // « the studio has no project open », and the second is not a parameter it can fix.
  it('refuses when no project is open, there being no path to point a clip at', () => {
    laid(sequenceWith([]))
    useProject.setState({ project: null, known: true })

    expect(() => otioExportFiles('doc-1')).toThrow()
  })
})

describe('exportOtio', () => {
  it('hands the same encoding to the save dialog', async () => {
    laid(sequenceWith(reindexTracks([trackFixture('V1', 'video', [clipFixture('a', 0, SECOND)])])))

    await expect(exportOtio('doc-1')).resolves.toBe('Bande.otio')
    expect(written).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bande' }))
  })

  it('names a live scene clip after its document, since it has no file to name it', async () => {
    laid(
      sequenceWith(
        reindexTracks([
          trackFixture('V1', 'video', [
            makeClip({ id: 'a', assetId: '', sceneId: 'scene-7', start: 0, duration: SECOND }),
          ]),
        ]),
      ),
      {
        'scene-7': {
          id: 'scene-7',
          kind: 'scene',
          workspace: '3d',
          title: 'Niveau 3',
          path: 'documents/Niveau 3.scene',
        },
      },
    )

    await exportOtio('doc-1')

    const clip = timelineWritten().tracks.children[0].children[0]
    expect(clip.media_reference.OTIO_SCHEMA).toBe('MissingReference.1')
    expect(clip.name).toBe('Niveau 3')
  })

  // Journaled rather than thrown at a menu click: nothing awaits this call, and a rejection into
  // no one's hands looks exactly like a dismissed dialog.
  it('writes nothing when no project is open', async () => {
    laid(sequenceWith([]))
    useProject.setState({ project: null, known: true })

    await expect(exportOtio('doc-1')).resolves.toBeNull()
    expect(written).not.toHaveBeenCalled()
  })
})
