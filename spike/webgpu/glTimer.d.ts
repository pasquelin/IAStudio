export type GlTimer = {
  begin: () => void
  end: () => void
  collect: () => number[]
  dispose: () => void
}
export function createGlTimer(gl: WebGL2RenderingContext): GlTimer | null
