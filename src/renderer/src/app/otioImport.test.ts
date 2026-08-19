import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import i18next from 'i18next'
import { TRANSLATIONS } from '@shared/i18n'
import { bundleOf } from '@shared/domain/otioz'
import type { MontageImportResult } from '@shared/ipc'
import { clipFixture, sequenceWith, trackFixture } from '@/engines/timeline/timeline-fixtures'
import { otioTimelineOf } from '@/engines/timeline/otioTimeline'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { importOtioz, sequenceOfBundle } from './otioImport'
import { montageIsIncomplete } from './sequenceDocument'

vi.mock('@/services/diagnostics', () => ({ reportFailure: () => {}, reportNotice: () => {} }))

/**
 * A bundle exactly as the writing side makes one: `bundleOf` rewrites every `target_url` to the
 * entry it takes inside the archive, and the entry is the only name the reading side has left.
 */
function bundled(): { content: string; media: readonly { entry: string; assetId: string }[] } {
  const state = sequenceWith([
    trackFixture('t1', 'video', [
      clipFixture('c1', 0, 1_000_000, { assetId: 'old-a' }),
      clipFixture('c2', 1_000_000, 1_000_000, { assetId: 'old-b' }),
    ]),
  ])

  const bundle = bundleOf(
    otioTimelineOf(state, {
      name: 'Bande',
      sourceOf: clip => ({
        name: clip.assetId ?? '',
        url: `file:///rushes/${clip.assetId ?? ''}.mp4`,
      }),
    }),
  )

  return {
    content: JSON.stringify(bundle.timeline),
    // What the main process answers: the entries it unpacked, paired with the rows they became.
    media: bundle.media.map((one, at) => ({ entry: one.entry, assetId: `new-${at}` })),
  }
}

describe('a bundle composed back into a montage', () => {
  it('points every clip at the row its medium was given on the way in', () => {
    const read = { ...bundled(), folder: 'Bande' }

    const assets = sequenceOfBundle(read, 'doc-1').tracks.flatMap(track =>
      track.clips.map(clip => clip.assetId),
    )

    expect(assets).toEqual(read.media.map(one => one.assetId))
  })

  /**
   * The cut is the FILE's, not a fresh one: what a montage from another application says about
   * its tracks and its trims is the whole reason to read it at all.
   */
  it('keeps the cut the file describes, track for track and clip for clip', () => {
    const composed = sequenceOfBundle({ ...bundled(), folder: 'Bande' }, 'doc-1')

    expect(composed.tracks).toHaveLength(1)
    expect(composed.tracks[0]?.clips.map(clip => clip.start)).toEqual([0, 1_000_000])
  })

  /**
   * A medium the catalogue refused gets no row, so the clip that named it resolves to nothing —
   * dropped rather than opened on a link that points at no asset.
   */
  it('drops a clip whose medium was never catalogued', () => {
    const read = bundled()

    const composed = sequenceOfBundle(
      { content: read.content, media: [], folder: 'Bande' },
      'doc-1',
    )

    expect(composed.tracks.flatMap(track => track.clips)).toEqual([])
  })
})

describe('importing a montage bundle', () => {
  let read: MontageImportResult

  // The refusals are what the last two cases read back, and this suite runs in the node project
  // where `initI18n` has neither a window nor its storage. The BUNDLE is the real one.
  beforeAll(async () => {
    await i18next.init({
      lng: 'fr',
      defaultNS: 'studio',
      resources: { fr: { studio: TRANSLATIONS.fr } },
      interpolation: { escapeValue: false },
    })
  })

  beforeEach(() => {
    read = { ...bundled(), folder: 'Bande' }
    installFakeBridge({ montage: { import: () => Promise.resolve(read) } })
    useDocuments.setState({ documents: {}, stored: [], activeId: null })
  })

  it('opens the montage the bundle describes as a document of its own', async () => {
    const created = await importOtioz()

    expect(created).not.toBeNull()
    expect(useDocuments.getState().documents[created ?? '']?.kind).toBe('sequence')
  })

  /**
   * The contre-exemple this chantier is against, reproduced on the document it had just made: the
   * bundle path went round the reader that keeps this bookkeeping, so the ⌘S a second later wrote
   * another application's metadata out of existence without a line anywhere.
   */
  it('refuses to save over what the file holds and this editor does not compose', async () => {
    const payload: Record<string, unknown> = JSON.parse(read.content)
    payload.metadata = { ...(payload.metadata as object), resolve: { colorSpace: 'Rec.709' } }
    read = { ...read, content: JSON.stringify(payload) }

    const created = await importOtioz()

    // The refusal of the HOLDS-MORE cause, spelled out: both causes answer « not null », and a
    // test that only asked that would pass on the other one.
    expect(montageIsIncomplete(created ?? '')).toContain('contient plus que ce que le studio')
  })

  /** « Ce que l'importeur ne sait pas reconstruire se DIT » — and a save that would drop it is not. */
  it('refuses to save a montage whose clips it could not all keep', async () => {
    read = { ...bundled(), media: [], folder: 'Bande' }

    const created = await importOtioz()

    expect(montageIsIncomplete(created ?? '')).toContain('sans les clips dont le média manque')
  })
})
