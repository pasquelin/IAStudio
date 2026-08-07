import { describe, expect, it, vi } from 'vitest'
import { hashFile, parseProbe, sampleRanges } from './probe'

const video = {
  streams: [
    {
      codec_type: 'video',
      codec_name: 'h264',
      width: 1920,
      height: 1080,
      r_frame_rate: '25/1',
    },
    { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2 },
  ],
  format: { duration: '12.5' },
}

describe('ffprobe output', () => {
  it('reads a video file down to the fields the timeline needs', () => {
    expect(parseProbe(video)).toEqual({
      duration: 12_500_000,
      codec: 'h264',
      width: 1920,
      height: 1080,
      fps: 25,
      sampleRate: 48_000,
      channels: 2,
    })
  })

  it('reads an audio-only file, which has no picture to describe', () => {
    const probe = parseProbe({
      streams: [{ codec_type: 'audio', codec_name: 'mp3', sample_rate: '44100', channels: 2 }],
      format: { duration: '3' },
    })

    expect(probe).toEqual({ duration: 3_000_000, codec: 'mp3', sampleRate: 44_100, channels: 2 })
  })

  it('takes the duration off the stream when the container declares none', () => {
    const probe = parseProbe({
      streams: [{ codec_type: 'video', codec_name: 'h264', duration: '2.5' }],
      format: {},
    })

    expect(probe?.duration).toBe(2_500_000)
  })

  it('divides the rational frame rate ffprobe reports', () => {
    const streams = [{ codec_type: 'video', codec_name: 'h264', r_frame_rate: '30000/1001' }]
    expect(parseProbe({ streams, format: { duration: '1' } })?.fps).toBeCloseTo(29.97, 2)
  })

  it('reads no frame rate from the still picture ffprobe reports as 0/0', () => {
    const streams = [{ codec_type: 'video', codec_name: 'png', r_frame_rate: '0/0' }]
    expect(parseProbe({ streams, format: { duration: '1' } })?.fps).toBeUndefined()
  })

  it('reads nothing from output carrying no stream, rather than inventing a duration', () => {
    expect(parseProbe({ streams: [], format: { duration: '5' } })).toBeNull()
    expect(parseProbe('not json at all')).toBeNull()
  })
})

describe('hash sampling', () => {
  it('samples three slices of a large file, head, middle and tail', () => {
    expect(sampleRanges(30, 4)).toEqual([
      { offset: 0, length: 4 },
      { offset: 13, length: 4 },
      { offset: 26, length: 4 },
    ])
  })

  it('reads a file smaller than three slices whole, since sampling would overlap', () => {
    expect(sampleRanges(10, 4)).toEqual([{ offset: 0, length: 10 }])
  })

  it('reads an empty file as nothing to read', () => {
    expect(sampleRanges(0, 4)).toEqual([])
  })

  it('reads the whole of a small file, in one range', async () => {
    const read = vi.fn(async () => new Uint8Array([1, 2, 3]))

    await hashFile('/rush.mov', { size: async () => 3, read, digest: () => 'abc' })
    expect(read).toHaveBeenCalledExactlyOnceWith('/rush.mov', 0, 3)
  })

  it('gives two files of the same bytes but different sizes different hashes', async () => {
    const deps = (size: number) => ({
      size: async () => size,
      read: async () => new Uint8Array([7, 7]),
      digest: (chunks: readonly Uint8Array[]) =>
        chunks.map(chunk => [...chunk].join('.')).join('|'),
    })

    expect(await hashFile('/a', deps(2))).not.toBe(await hashFile('/b', deps(200)))
  })
})
