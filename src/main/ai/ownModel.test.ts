import { describe, expect, it, vi } from 'vitest'
import { GGUF_MAGIC } from '@shared/domain/gguf'
import { HEADER_WINDOWS, ownModelFrom, ownModelId, UnreadableWeights } from './ownModel'

/**
 * The smallest GGUF the reader accepts: magic, version 3, no tensor, one string entry.
 *
 * Written by hand for the reason `gguf.test.ts` gives — the smallest real model is half a
 * gigabyte, and what is exercised here is the manifest, not a publisher's metadata.
 */
function ggufBytes(name: string): Uint8Array {
  const parts: number[] = []
  const write32 = (value: number): void => {
    for (let byte = 0; byte < 4; byte += 1) parts.push((value >>> (byte * 8)) & 0xff)
  }
  const u64 = (value: number): void => {
    write32(value)
    write32(0)
  }
  const text = (value: string): void => {
    const bytes = new TextEncoder().encode(value)
    u64(bytes.byteLength)
    parts.push(...bytes)
  }

  write32(GGUF_MAGIC)
  write32(3)
  u64(0)
  u64(1)
  text('general.name')
  write32(8)
  text(name)

  return new Uint8Array(parts)
}

const disk = (bytes: Uint8Array, size = 4_683_073_632) => ({
  readHead: (_path: string, wanted: number) => Promise.resolve(bytes.subarray(0, wanted)),
  sizeOf: () => Promise.resolve(size),
})

describe('ownModelFrom', () => {
  /**
   * The whole of rank 3's gesture: what the header says, what the file system says, and a mark
   * saying the studio vouches for none of it — ADR-20 § B as amended.
   */
  it('composes a manifest from the header and the file system, marked as unvouched for', async () => {
    const model = await ownModelFrom('/weights/mine.gguf', disk(ggufBytes('Their Model')))

    expect(model).toMatchObject({
      name: 'Their Model',
      format: 'gguf',
      loader: 'llamacpp',
      rank: 3,
      licence: '',
      files: [],
      diskBytes: 4_683_073_632,
      modality: 'text',
      weightsPath: '/weights/mine.gguf',
    })
  })

  // Nothing was fetched, so nothing is in the model folder: `weightsPath` is what says there is
  // nothing to download, and an empty file list is what says it to the installer.
  it('reserves above what the weights weigh, and says the figure is an estimate', async () => {
    const model = await ownModelFrom('/weights/mine.gguf', disk(ggufBytes('m'), 1_000_000_000))

    expect(model.reservationBytes).toBeGreaterThan(model.diskBytes)
  })

  // A model with no name at all would be a row nobody can tell from the next one.
  it('falls back to the file name where the publisher wrote none', async () => {
    const empty = ggufBytes('')
    const model = await ownModelFrom('/weights/qwen-7b.gguf', disk(empty))

    expect(model.name).toBe('qwen-7b.gguf')
  })

  /**
   * Two folders holding `model.gguf` are two models. Keying on the file NAME would have the
   * second replace the first without a word — which is why the id is a digest of the path.
   */
  it('gives two files of the same name two identities', () => {
    expect(ownModelId('/a/model.gguf')).not.toBe(ownModelId('/b/model.gguf'))
    expect(ownModelId('/a/model.gguf')).toBe(ownModelId('/a/model.gguf'))
  })

  it('refuses a file that is not a GGUF rather than recording an empty manifest', async () => {
    const bytes = new TextEncoder().encode('this is a photograph')

    await expect(ownModelFrom('/weights/photo.png', disk(bytes))).rejects.toThrow(UnreadableWeights)
  })

  /**
   * A large model's metadata runs past any first read — a tokenizer alone is tens of thousands of
   * strings. The window GROWS rather than the read failing, and a header that fits the first one
   * costs exactly one read.
   */
  it('reads further when the metadata runs past the window, and no further than it must', async () => {
    const bytes = ggufBytes('Small')
    const readHead = vi.fn((_path: string, wanted: number) =>
      Promise.resolve(bytes.subarray(0, wanted)),
    )

    await ownModelFrom('/weights/mine.gguf', { readHead, sizeOf: () => Promise.resolve(1) })
    expect(readHead).toHaveBeenCalledOnce()

    const cut = vi.fn((_path: string, wanted: number) =>
      Promise.resolve(bytes.subarray(0, Math.min(wanted, bytes.byteLength - 4))),
    )
    await expect(
      ownModelFrom('/weights/mine.gguf', { readHead: cut, sizeOf: () => Promise.resolve(1) }),
    ).rejects.toThrow(UnreadableWeights)
    expect(cut).toHaveBeenCalledTimes(HEADER_WINDOWS.length)
  })
})
