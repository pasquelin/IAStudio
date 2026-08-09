import { describe, expect, it } from 'vitest'
import { emptyGpuStats, recordFrame, type FrameCounters } from './gpu-stats'

const counters = (
  render: Partial<FrameCounters['info']['render']> = {},
  memory: Partial<FrameCounters['info']['memory']> = {},
): FrameCounters => ({
  info: {
    render: { calls: 0, triangles: 0, points: 0, lines: 0, ...render },
    memory: { geometries: 0, textures: 0, ...memory },
  },
})

describe('gpu stats', () => {
  it('starts at zero, so a viewport that never drew reports nothing', () => {
    expect(emptyGpuStats()).toEqual({
      calls: 0,
      triangles: 0,
      points: 0,
      lines: 0,
      frames: 0,
      geometries: 0,
      textures: 0,
    })
  })

  it('takes what the last frame cost off the renderer', () => {
    const stats = emptyGpuStats()

    recordFrame(counters({ calls: 12, triangles: 4096, points: 3, lines: 7 }), stats)

    expect(stats).toMatchObject({ calls: 12, triangles: 4096, points: 3, lines: 7 })
  })

  it('takes what the context holds, which is a total and not a per-frame cost', () => {
    const stats = emptyGpuStats()

    recordFrame(counters({}, { geometries: 9, textures: 5 }), stats)

    expect(stats).toMatchObject({ geometries: 9, textures: 5 })
  })

  /** The whole point of the counter: a lot that claims a frame got cheaper needs the old one gone. */
  it('replaces the previous frame rather than summing it', () => {
    const stats = emptyGpuStats()

    recordFrame(counters({ calls: 40, triangles: 900 }), stats)
    recordFrame(counters({ calls: 3, triangles: 12 }), stats)

    expect(stats).toMatchObject({ calls: 3, triangles: 12 })
  })

  /** Counted here, not read off `info.render.frame`, which counts `render` calls — two per frame. */
  it('counts frames upwards, one per drawn frame', () => {
    const stats = emptyGpuStats()

    recordFrame(counters(), stats)
    recordFrame(counters(), stats)
    recordFrame(counters(), stats)

    expect(stats.frames).toBe(3)
  })
})
