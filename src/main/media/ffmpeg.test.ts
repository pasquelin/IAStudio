import { describe, expect, it } from 'vitest'
import { peaksArgs, probeArgs, proxyArgs, resolveFfmpeg } from './ffmpeg'

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

  it('produces a fast-start proxy, readable before the last byte is written', () => {
    expect(proxyArgs('/in.mov', '/out.mp4').join(' ')).toContain('+faststart')
  })

  it('asks for mono 16-bit PCM when extracting peaks', () => {
    const args = peaksArgs('/in.mov')
    expect(args).toContain('s16le')
    expect(args).toContain('pipe:1')
  })
})
