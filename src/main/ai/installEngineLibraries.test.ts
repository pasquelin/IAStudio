import { describe, expect, it, vi } from 'vitest'
import { installEngineLibraries, pipProgress } from './installEngineLibraries'

describe('reading pip’s own bar', () => {
  it('answers nothing for a line that carries no size', () => {
    const read = pipProgress()

    expect(read('Collecting torch==2.13.0')).toBeNull()
  })

  /** A 682 MB download that walked backwards would read as a failure, not as a resolver. */
  it('never walks backwards when the resolver finds one more wheel', () => {
    const read = pipProgress()
    read('  ━━━━━━━━ 60.0/60.0 MB 5.0 MB/s')
    const settled = read('  ━━━━━━━━ 60.0/60.0 MB 5.0 MB/s') ?? 0

    // A second wheel: the total grows under a reading that was already near its end.
    expect(read('  ━━ 1.0/600.0 MB 5.0 MB/s') ?? 0).toBeGreaterThanOrEqual(settled)
  })

  it('stops short of the end, which pip draws no bar for', () => {
    const read = pipProgress()

    expect(read('  ━━━━━━━━ 60.0/60.0 MB 5.0 MB/s')).toBeLessThan(1)
  })

  it('reads kilobytes and gigabytes on the same scale as megabytes', () => {
    const read = pipProgress()

    expect(read('  ━━ 0.5/1.0 GB 5.0 MB/s')).toBeCloseTo(0.5, 2)
  })
})

describe('installing what the engine named', () => {
  const spawned = () => {
    const spawn = vi.fn(() => Promise.resolve())
    return { spawn }
  }

  it('hands pip the declaration verbatim, in one run', async () => {
    const held = spawned()

    await installEngineLibraries({
      python: '/app/engine/python/bin/python3',
      declaration: ['torch>=2.6', 'diffusers>=0.40'],
      spawn: held.spawn,
      onProgress: () => {},
      signal: new AbortController().signal,
    })

    expect(held.spawn).toHaveBeenCalledWith(
      '/app/engine/python/bin/python3',
      ['-m', 'pip', 'install', '--upgrade', '--no-input', 'torch>=2.6', 'diffusers>=0.40'],
      expect.any(Function),
      expect.anything(),
    )
  })

  /** An engine that answered a complete environment must not spawn pip to install nothing. */
  it('runs nothing when there is nothing to install', async () => {
    const held = spawned()

    await installEngineLibraries({
      python: '/app/engine/python/bin/python3',
      declaration: [],
      spawn: held.spawn,
      onProgress: () => {},
      signal: new AbortController().signal,
    })

    expect(held.spawn).not.toHaveBeenCalled()
  })
})
