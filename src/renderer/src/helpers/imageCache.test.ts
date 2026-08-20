import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cachedBytes, cachedImage, forgetImages } from './imageCache'

/** jsdom fetches nothing and decodes nothing: the load is driven by hand. */
class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  src = ''

  constructor() {
    built.push(this)
  }
}

let built: FakeImage[] = []

const MEGAPIXEL = 512
/** 512 × 512 × 4 bytes: one megabyte of decoded picture per image. */
const BYTES_EACH = MEGAPIXEL * MEGAPIXEL * 4

function decodeLast(): void {
  const image = built.at(-1)
  if (!image) throw new Error('no image was created')
  image.naturalWidth = MEGAPIXEL
  image.naturalHeight = MEGAPIXEL
  image.onload?.()
}

function load(url: string, onReady = (): void => {}): void {
  cachedImage(url, onReady)
  decodeLast()
}

describe('cachedImage', () => {
  beforeEach(() => {
    built = []
    forgetImages()
    vi.stubGlobal('Image', FakeImage)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('answers nothing while a picture is still decoding, and the picture once it is', () => {
    const url = 'ia-studio://asset-1/poster'
    expect(cachedImage(url, () => {})).toBeNull()

    decodeLast()

    expect(cachedImage(url, () => {})).toBe(built[0])
  })

  it('fetches a given url once, however many paints ask for it', () => {
    load('ia-studio://asset-1/poster')
    cachedImage('ia-studio://asset-1/poster', () => {})
    cachedImage('ia-studio://asset-1/poster', () => {})

    expect(built).toHaveLength(1)
  })

  it('tells the caller to repaint once the picture is there', () => {
    const onReady = vi.fn()
    load('ia-studio://asset-1/poster', onReady)

    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('counts what it holds in decoded bytes, not in entries', () => {
    load('ia-studio://asset-1/poster')
    load('ia-studio://asset-2/poster')

    expect(cachedBytes()).toBe(2 * BYTES_EACH)
  })

  it('stays under its budget however many pictures a project has', () => {
    // Ninety-six megabytes of budget, one megabyte each: a hundred and twenty is past it.
    for (let index = 0; index < 120; index++) load(`ia-studio://asset-${index}/poster`)

    expect(cachedBytes()).toBeLessThanOrEqual(96 * 1024 * 1024)
    expect(built).toHaveLength(120)
  })

  it('drops the picture nobody has asked for in longest', () => {
    for (let index = 0; index < 96; index++) load(`ia-studio://asset-${index}/poster`)

    // Touched, so it is no longer the oldest: the next arrival must take someone else.
    cachedImage('ia-studio://asset-0/poster', () => {})
    load('ia-studio://asset-96/poster')

    expect(cachedImage('ia-studio://asset-0/poster', () => {})).not.toBeNull()
    expect(cachedImage('ia-studio://asset-1/poster', () => {})).toBeNull()
  })

  it('never evicts the picture that was just decoded', () => {
    for (let index = 0; index < 200; index++) load(`ia-studio://asset-${index}/poster`)

    expect(cachedImage('ia-studio://asset-199/poster', () => {})).not.toBeNull()
  })

  it('remembers a failure rather than fetching it again on every paint', () => {
    cachedImage('ia-studio://gone/poster', () => {})
    built[0]?.onerror?.()

    expect(cachedImage('ia-studio://gone/poster', () => {})).toBeNull()
    expect(built).toHaveLength(1)
  })
})
