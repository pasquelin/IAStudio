import { describe, expect, it, vi } from 'vitest'
import {
  FRAME_PATTERN,
  createFfmpegResolver,
  frameName,
  peaksArgs,
  probeArgs,
  proxyArgs,
  resolveFfmpeg,
  sequenceArgs,
} from './ffmpeg'

describe('ffmpeg resolution', () => {
  it('prefers the bundled binary', () => {
    const path = resolveFfmpeg({
      bundled: '/app/resources/ffmpeg/ffmpeg',
      configured: '/usr/local/bin/ffmpeg',
      onPath: '/usr/bin/ffmpeg',
      exists: () => true,
    })
    expect(path).toBe('/app/resources/ffmpeg/ffmpeg')
  })

  it('falls back to the configured path when nothing is bundled', () => {
    const path = resolveFfmpeg({
      bundled: '/app/resources/ffmpeg/ffmpeg',
      configured: '/usr/local/bin/ffmpeg',
      onPath: '/usr/bin/ffmpeg',
      exists: candidate => candidate !== '/app/resources/ffmpeg/ffmpeg',
    })
    expect(path).toBe('/usr/local/bin/ffmpeg')
  })

  it('falls back to the one on the PATH when nothing else answers', () => {
    const path = resolveFfmpeg({
      bundled: undefined,
      configured: undefined,
      onPath: '/usr/bin/ffmpeg',
      exists: () => true,
    })
    expect(path).toBe('/usr/bin/ffmpeg')
  })

  it('returns null when there is none, so the app can say so instead of crashing', () => {
    const path = resolveFfmpeg({
      bundled: undefined,
      configured: undefined,
      onPath: undefined,
      exists: () => false,
    })
    expect(path).toBeNull()
  })

  it('ignores a configured path that does not exist', () => {
    const path = resolveFfmpeg({
      bundled: undefined,
      configured: '/gone/ffmpeg',
      onPath: '/usr/bin/ffmpeg',
      exists: candidate => candidate === '/usr/bin/ffmpeg',
    })
    expect(path).toBe('/usr/bin/ffmpeg')
  })
})

describe('ffmpeg arguments', () => {
  it('asks ffprobe for JSON on both streams and format', () => {
    const args = probeArgs('/in.mov')
    expect(args).toContain('-print_format')
    expect(args).toContain('json')
    expect(args.at(-1)).toBe('/in.mov')
  })

  it('scales the proxy to 720p while keeping an even width, which H.264 requires', () => {
    const args = proxyArgs('/in.mov', '/out.mp4')
    expect(args).toContain('scale=-2:720')
    expect(args.at(-1)).toBe('/out.mp4')
  })

  it('walks the candidates once and remembers the answer', () => {
    const candidates = vi.fn(() => ({
      bundled: undefined,
      configured: undefined,
      onPath: '/usr/bin/ffmpeg',
      exists: () => true,
    }))
    const resolver = createFfmpegResolver(candidates)

    resolver.path()
    resolver.path()

    // Resolution is one `existsSync` per PATH entry, and the path is asked twice per file.
    expect(candidates).toHaveBeenCalledOnce()
  })

  it('walks them again once invalidated, since ffmpeg may have been installed since', () => {
    let installed = false
    const resolver = createFfmpegResolver(() => ({
      bundled: undefined,
      configured: undefined,
      onPath: '/usr/bin/ffmpeg',
      exists: () => installed,
    }))

    expect(resolver.path()).toBeNull()
    installed = true
    expect(resolver.path()).toBeNull()

    resolver.invalidate()
    expect(resolver.path()).toBe('/usr/bin/ffmpeg')
  })

  it('produces a fast-start proxy, readable before the last byte is written', () => {
    expect(proxyArgs('/in.mov', '/out.mp4').join(' ')).toContain('+faststart')
  })

  it('silences the per-second progress line, which nobody reads and the runner would keep', () => {
    expect(proxyArgs('/in.mov', '/out.mp4')).toContain('-nostats')
  })

  it('asks for mono 16-bit PCM when extracting peaks', () => {
    const args = peaksArgs('/in.mov')
    expect(args).toContain('s16le')
    expect(args).toContain('pipe:1')
  })
})

describe('encoding a render', () => {
  it('declares the rate of the stills rather than a rate to reach', () => {
    const args = sequenceArgs('/tmp/render/frame_%06d.png', '/out.mp4', 25)
    const rate = args.indexOf('-framerate')
    const input = args.indexOf('-i')

    // Placed after `-i`, the same flag means "resample to this", and ffmpeg would duplicate or
    // drop frames to reach it.
    expect(rate).toBeGreaterThanOrEqual(0)
    expect(rate).toBeLessThan(input)
    expect(args[rate + 1]).toBe('25')
  })

  it('writes a pixel format players actually accept', () => {
    expect(sequenceArgs('/in/%06d.png', '/out.mp4', 25)).toContain('yuv420p')
  })

  it('names its frames zero-padded, in the order ffmpeg reads them', () => {
    expect(frameName(1)).toBe('frame_000001.png')
    expect(frameName(1234)).toBe('frame_001234.png')
    // The pattern and the names have to agree, or ffmpeg finds no frame at all.
    expect(FRAME_PATTERN.replace('%06d', '000001')).toBe(frameName(1))
  })

  it('ends on the file it writes', () => {
    expect(sequenceArgs('/in/%06d.png', '/out.mp4', 30).at(-1)).toBe('/out.mp4')
  })
})
