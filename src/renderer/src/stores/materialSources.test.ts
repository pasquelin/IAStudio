import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from './assets'
import { materialPayload } from '@/app/materialDocument'
import { newMaterial } from '@/engines/material/materialState'
import { setChannel } from '@/engines/material/commands'
import { loadMaterialSource, wornMaterialOf } from './materialSources'

/** One id per case: this store lives for the module, and a copy read in one test outlives it. */
let MATERIAL = ''
let read = 0

/** The picture the material names, as the catalogue answers for it. */
const picture = (): Asset => ({
  id: 'asset-base',
  name: 'pierre',
  path: 'Images/pierre.png',
  type: 'texture',
  location: 'local',
  tags: [],
  createdAt: '2026-08-26T10:00:00.000Z',
})

/** What the studio would have written for a material holding one picture in its base colour. */
function onDisk(): string {
  useAssets.setState({ items: [picture()] })

  const state = setChannel('baseColor', {
    assetId: 'asset-base',
    origin: 'imported',
    width: 8,
    height: 8,
  }).apply(newMaterial())

  return JSON.stringify(materialPayload(state, MATERIAL))
}

/** What the file holds for this read — a decor changes it to answer differently the second time. */
let answers = ''

describe('the materials a scene dresses its models with', () => {
  beforeEach(() => {
    useAssets.setState({ items: [picture()] })
    read += 1
    MATERIAL = `mat-${read}`
    answers = onDisk()
    installFakeBridge({
      documents: {
        read: () =>
          Promise.resolve({
            id: MATERIAL,
            kind: 'material',
            version: 1,
            title: 'Pierre',
            updatedAt: '2026-08-26T10:00:00.000Z',
            content: answers,
          }),
      },
    })
  })

  /**
   * `DocumentFile.content` is the SERIALIZED text, not the payload — the door an open tab comes
   * through parses it. Handed the string, `materialFromPayload` finds no record in it and answers
   * an empty material, so every model wearing a document nobody had opened silently went back to
   * the maps its own file carries. Nothing rougissait: an empty material is a legal one.
   */
  it('reads a material nobody has opened off its file, channels and all', async () => {
    await loadMaterialSource(MATERIAL)

    expect(wornMaterialOf(MATERIAL)?.channels.baseColor).toMatchObject({ assetId: 'asset-base' })
  })

  /**
   * A `.mtlx` names its pictures by a path RELATIVE to its own folder, so resolving one needs the
   * project listing as well as the catalogue. Read before either has landed — a scene opening
   * before its folder is listed — every channel resolves to nothing, and the once-only read kept
   * that emptiness for the whole session: the model wore its own maps until a relaunch.
   */
  it('reads a material again when the first read resolved no picture', async () => {
    // The file NAMES a picture, the read resolved none, and there was NOTHING to resolve
    // against: the three together are what say the read came too early.
    answers = '{"values":[],"images":[{"input":"base_color","type":"color3","file":"nowhere.png"}]}'
    useAssets.setState({ items: [] })
    await loadMaterialSource(MATERIAL)
    expect(wornMaterialOf(MATERIAL)?.channels.baseColor?.assetId).toBeFalsy()

    // The catalogue LANDING is the signal; a shelf that merely grows is not.
    useAssets.setState({ items: [picture()] })
    expect(wornMaterialOf(MATERIAL)).toBeNull()

    answers = onDisk()
    await loadMaterialSource(MATERIAL)

    expect(wornMaterialOf(MATERIAL)?.channels.baseColor).toMatchObject({ assetId: 'asset-base' })
  })

  /**
   * A file that names NO picture is whole the moment it is read — a material may hold only dials.
   * Deduced from an empty channel set instead, it would read as « came too early » for ever, and
   * its file would be read again on every move of the catalogue.
   */
  it('keeps a material that names no picture at all', async () => {
    answers = '{"values":[],"images":[]}'
    await loadMaterialSource(MATERIAL)
    const first = wornMaterialOf(MATERIAL)

    useAssets.setState({ items: [picture(), picture()] })

    expect(wornMaterialOf(MATERIAL)).toBe(first)
  })

  /**
   * A read that HAD a catalogue and still missed a picture names a file that is simply gone.
   * Retried on every move, it would re-read its document five times a second during an ingest and
   * never answer any better.
   */
  it('keeps a copy that missed a picture the catalogue could have answered for', async () => {
    answers = '{"values":[],"images":[{"input":"base_color","type":"color3","file":"gone.png"}]}'
    await loadMaterialSource(MATERIAL)
    const first = wornMaterialOf(MATERIAL)

    useAssets.setState({ items: [picture(), picture()] })

    expect(wornMaterialOf(MATERIAL)).toBe(first)
  })

  // A copy that DID resolve is kept: re-reading every material of a scene on each catalogue move
  // is a file read per model, several times a second during an ingest.
  it('keeps a copy that resolved, however much the catalogue moves', async () => {
    await loadMaterialSource(MATERIAL)
    const first = wornMaterialOf(MATERIAL)

    useAssets.setState({ items: [picture(), picture()] })

    expect(wornMaterialOf(MATERIAL)).toBe(first)
  })

  it('reads that file once, however many models name it', async () => {
    await loadMaterialSource(MATERIAL)
    const first = wornMaterialOf(MATERIAL)

    await loadMaterialSource(MATERIAL)

    expect(wornMaterialOf(MATERIAL)).toBe(first)
  })
})
