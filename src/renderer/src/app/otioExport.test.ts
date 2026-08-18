import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { MontageExportRequest } from '@shared/ipc'
import { clipFixture, sequenceWith, trackFixture } from '@/engines/timeline/timeline-fixtures'
import { makeClip, reindexTracks, SECOND } from '@/engines/timeline/timelineState'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { exportOtio, fileUrlOf } from './otioExport'

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

describe('exportOtio', () => {
  it('points a clip at the file its asset holds, wherever the project sits', async () => {
    await expect(
      exportOtio(
        sequenceWith(reindexTracks([trackFixture('V1', 'video', [clipFixture('a', 0, SECOND)])])),
        'Bande',
      ),
    ).resolves.toBe('Bande.otio')

    expect(written).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bande' }))
    expect(timelineWritten().tracks.children[0].children[0].media_reference).toMatchObject({
      OTIO_SCHEMA: 'ExternalReference.1',
      name: 'Plan large',
      target_url: 'file:///Volumes/Travail/Film/assets/vid/plan%20large.mp4',
    })
  })

  it('names a live scene clip after its document, since it has no file to name it', async () => {
    // Written out rather than through `installDocument`, which titles a document by its own id:
    // this case is exactly about telling the title from the id it falls back to.
    useDocuments.setState({
      documents: {
        'scene-7': {
          id: 'scene-7',
          kind: 'scene',
          workspace: '3d',
          title: 'Niveau 3',
          path: 'documents/Niveau 3.scene',
        },
      },
      activeId: 'scene-7',
    })

    await exportOtio(
      sequenceWith(
        reindexTracks([
          trackFixture('V1', 'video', [
            makeClip({ id: 'a', assetId: '', sceneId: 'scene-7', start: 0, duration: SECOND }),
          ]),
        ]),
      ),
      'Bande',
    )

    const clip = timelineWritten().tracks.children[0].children[0]
    expect(clip.media_reference.OTIO_SCHEMA).toBe('MissingReference.1')
    expect(clip.name).toBe('Niveau 3')
  })

  it('writes nothing when no project is open, there being no file to point at', async () => {
    useProject.setState({ project: null, known: true })

    await expect(exportOtio(sequenceWith([]), 'Bande')).resolves.toBeNull()
    expect(written).not.toHaveBeenCalled()
  })
})
