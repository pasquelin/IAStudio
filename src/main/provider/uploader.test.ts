import { describe, expect, it, vi } from 'vitest'
import { createAssetUploader, decodedBytes, MAX_UPLOAD_BYTES } from './uploader'

/** A base64 payload of exactly `bytes` decoded bytes. */
const payload = (bytes: number): string => 'A'.repeat(Math.ceil(bytes / 3) * 4)

describe('measuring a base64 payload', () => {
  it('counts three bytes for every four characters', () => {
    expect(decodedBytes('AAAA')).toBe(3)
    expect(decodedBytes('AAAAAAAA')).toBe(6)
  })

  it('takes the padding off', () => {
    expect(decodedBytes('AAA=')).toBe(2)
    expect(decodedBytes('AA==')).toBe(1)
  })
})

describe('uploading a picture', () => {
  it('hands back the id the API kept it under', async () => {
    const upload = vi.fn(() => Promise.resolve({ asset: { id: 'asset_9' } }))
    const uploader = createAssetUploader(() => ({ upload }))

    await expect(uploader.upload('canvas.png', 'AAAA')).resolves.toBe('asset_9')
    expect(upload).toHaveBeenCalledWith({ name: 'canvas.png', image: 'AAAA' })
  })

  /**
   * Past six megabytes the API wants the multipart flow of `/v1/uploads` instead. Refused here
   * and named, rather than sent and answered with an opaque 4xx nobody can act on.
   */
  it('refuses what is too large for this route, out loud', async () => {
    const upload = vi.fn(() => Promise.resolve({ asset: { id: 'asset_9' } }))
    const uploader = createAssetUploader(() => ({ upload }))

    await expect(uploader.upload('big.png', payload(MAX_UPLOAD_BYTES + 1024))).rejects.toThrow(
      'upload-too-large',
    )
    expect(upload).not.toHaveBeenCalled()
  })

  it('sends what fits', async () => {
    const upload = vi.fn(() => Promise.resolve({ asset: { id: 'asset_9' } }))
    const uploader = createAssetUploader(() => ({ upload }))

    await uploader.upload('fits.png', payload(MAX_UPLOAD_BYTES - 1024))

    expect(upload).toHaveBeenCalled()
  })
})
