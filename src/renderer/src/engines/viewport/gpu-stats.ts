/**
 * What one drawn frame cost the GPU, and what its context is still holding.
 *
 * Out of `ViewportEngine` for the reason `frame-clock` is out of it: that class cannot exist
 * without a WebGL context, and these numbers are what a GPU change has to prove itself with.
 */
export type GpuStats = {
  /** Draw calls of the whole frame — the scene pass and the overlay pass together. */
  calls: number
  triangles: number
  points: number
  lines: number
  /** Frames drawn since mount. A viewport left alone has to stop moving this number. */
  frames: number
  /** Alive in the context now, not per frame: what a missing `dispose` makes climb. */
  geometries: number
  textures: number
}

/**
 * Only the counters that are read, so a test can hand them over without a WebGL context. A real
 * `WebGLRenderer` satisfies this by shape.
 */
export type FrameCounters = {
  info: {
    render: { calls: number; triangles: number; points: number; lines: number }
    memory: { geometries: number; textures: number }
  }
}

export function emptyGpuStats(): GpuStats {
  return { calls: 0, triangles: 0, points: 0, lines: 0, frames: 0, geometries: 0, textures: 0 }
}

/**
 * Folds a drawn frame into `into`, in place — a fresh object per frame is exactly the
 * allocation a render loop must not make.
 *
 * `frames` is counted here rather than read off `info.render.frame`, which counts calls to
 * `render`: a viewport that draws an overlay makes two of those per frame.
 */
export function recordFrame(renderer: FrameCounters, into: GpuStats): void {
  const { render, memory } = renderer.info
  into.calls = render.calls
  into.triangles = render.triangles
  into.points = render.points
  into.lines = render.lines
  into.geometries = memory.geometries
  into.textures = memory.textures
  into.frames += 1
}
