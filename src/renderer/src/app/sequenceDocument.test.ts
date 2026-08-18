import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { LogEntry } from '@shared/ipc'
import { TRANSLATIONS } from '@shared/i18n'
import i18next from 'i18next'
import { clipFixture, sequenceWith, trackFixture } from '@/engines/timeline/timeline-fixtures'
import { reindexTracks, SECOND } from '@/engines/timeline/timelineState'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { sequenceFromPayload, sequencePayload, serializeSequencePayload } from './sequenceDocument'

const RUSH: Asset = {
  id: 'asset-a',
  name: 'Plan large',
  type: 'video',
  location: 'local',
  path: 'assets/vid/plan large.mp4',
  tags: [],
  createdAt: '2026-08-18T10:00:00.000Z',
}

const reported = vi.fn<(entry: LogEntry) => Promise<void>>()

/** Only the parts of a written timeline these cases read back. */
type WrittenTimeline = {
  metadata: { scenario: { documentId?: string } }
  tracks: { children: { children: { media_reference: { target_url?: string; name: string } }[] }[] }
}

/** The payload is composed here, so its shape is known — this only names what is read of it. */
const written = (payload: unknown): WrittenTimeline => payload as WrittenTimeline

const firstReference = (payload: unknown): { target_url?: string; name: string } => {
  const reference = written(payload).tracks.children[0]?.children[0]?.media_reference
  if (!reference) throw new Error('the montage came out with no clip at all')
  return reference
}

/** Which file `doc-1` is held in — the one thing that decides what a save writes. */
function heldIn(path: string): void {
  useDocuments.setState({
    documents: {
      'doc-1': { id: 'doc-1', kind: 'sequence', workspace: 'video', title: 'Bande', path },
    },
    activeId: 'doc-1',
  })
}

const ONE_CLIP = sequenceWith(
  reindexTracks([trackFixture('V1', 'video', [clipFixture('a', 0, SECOND)])]),
)

// The message is what the last case reads back. Wired here rather than through `initI18n`, which
// declares the document's language and reads this window's storage: this suite runs in the node
// project, and neither exists there. The BUNDLE is the real one.
beforeAll(async () => {
  await i18next.init({
    lng: 'fr',
    defaultNS: 'studio',
    resources: { fr: { studio: TRANSLATIONS.fr } },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  reported.mockReset()
  reported.mockResolvedValue()
  installFakeBridge({ diagnostics: { report: reported } })
  useAssets.setState({ items: [RUSH] })
})

describe('what a save writes for a montage', () => {
  it('leaves a document of the studio’s own spelling exactly as it was', () => {
    heldIn('documents/Bande.seq')

    expect(sequencePayload(ONE_CLIP, 'doc-1')).toBe(ONE_CLIP)
  })

  /**
   * The whole point of the open format BEING the document: a `.otio` holds a standard timeline,
   * its media pointed at from the montage's OWN folder — which is what lets the project be
   * moved, copied or synced without every clip going missing.
   */
  it('writes a standard timeline with links relative to the montage’s folder', () => {
    heldIn('Cinematics/Bande.otio')

    expect(firstReference(sequencePayload(ONE_CLIP, 'doc-1'))).toMatchObject({
      name: 'Plan large',
      target_url: '../assets/vid/plan%20large.mp4',
    })
  })

  // Without it, a montage renamed on disk comes back as a different document — its tab, its
  // place in the layout and its recent entry all keyed on the name it has just stopped having.
  it('remembers which document the file is', () => {
    heldIn('Bande.otio')

    expect(written(sequencePayload(ONE_CLIP, 'doc-1')).metadata.scenario.documentId).toBe('doc-1')
  })

  it('indents the open format and not the studio’s own', () => {
    expect(serializeSequencePayload({ OTIO_SCHEMA: 'Timeline.1' })).toContain('\n')
    expect(serializeSequencePayload({ tracks: [] })).not.toContain('\n')
  })
})

describe('what an open reads back', () => {
  it('takes a montage of ours back whole, media and all', () => {
    heldIn('Cinematics/Bande.otio')

    expect(sequenceFromPayload(sequencePayload(ONE_CLIP, 'doc-1'), 'doc-1')).toEqual(ONE_CLIP)
  })

  // The payload decides, not the extension: a montage renamed by hand must open as what it holds.
  it('reads a standard timeline out of a file whose name does not claim to be one', () => {
    heldIn('Cinematics/Bande.otio')
    const timeline = sequencePayload(ONE_CLIP, 'doc-1')
    heldIn('Cinematics/Bande.seq')

    expect(sequenceFromPayload(timeline, 'doc-1')).toEqual(ONE_CLIP)
  })

  /**
   * A file from Resolve or Premiere names its media by path and knows nothing of our ids. The
   * relink is what turns that path back into a line of the catalogue.
   */
  it('relinks a foreign clip by the tail of its absolute link', () => {
    heldIn('Bande.otio')
    const state = sequenceFromPayload(foreign('file:///Volumes/Autre/vid/plan large.mp4'), 'doc-1')

    expect(state.tracks[0]?.clips[0]?.assetId).toBe('asset-a')
    expect(reported).not.toHaveBeenCalled()
  })

  it('relinks a foreign clip by file name when no folder lines up', () => {
    heldIn('Bande.otio')
    const state = sequenceFromPayload(foreign('file:///Volumes/Autre/plan large.mp4'), 'doc-1')

    expect(state.tracks[0]?.clips[0]?.assetId).toBe('asset-a')
  })

  /**
   * Said out loud rather than swallowed: a clip nothing could be found for is DROPPED, and a cut
   * that silently opens shorter than it was written is the worst answer available.
   */
  it('says which media it could not find, rather than opening shorter in silence', () => {
    heldIn('Bande.otio')
    const state = sequenceFromPayload(foreign('file:///Volumes/Autre/inconnu.mp4'), 'doc-1')

    expect(state.tracks[0]?.clips).toEqual([])
    expect(reported).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warn', scope: 'document.load' }),
    )
    expect(reported.mock.calls[0]?.[0].message).toContain('inconnu.mp4')
  })
})

/** A timeline as another application writes one: a media named by path, and no studio metadata. */
function foreign(targetUrl: string): unknown {
  const time = (value: number): unknown => ({ OTIO_SCHEMA: 'RationalTime.1', rate: 25, value })

  return {
    OTIO_SCHEMA: 'Timeline.1',
    name: 'Cut',
    metadata: {},
    global_start_time: time(0),
    tracks: {
      OTIO_SCHEMA: 'Stack.1',
      name: 'tracks',
      metadata: {},
      children: [
        {
          OTIO_SCHEMA: 'Track.1',
          name: 'V1',
          kind: 'Video',
          metadata: {},
          enabled: true,
          children: [
            {
              OTIO_SCHEMA: 'Clip.1',
              name: 'take',
              metadata: {},
              enabled: true,
              effects: [],
              markers: [],
              source_range: {
                OTIO_SCHEMA: 'TimeRange.1',
                start_time: time(0),
                duration: time(25),
              },
              media_reference: {
                OTIO_SCHEMA: 'ExternalReference.1',
                name: 'take',
                metadata: {},
                available_range: null,
                target_url: targetUrl,
              },
            },
          ],
        },
      ],
    },
  }
}
