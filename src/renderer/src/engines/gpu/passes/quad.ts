/**
 * The vertex half of every full-screen pass. Written once: a pass differs from another by what
 * its fragment shader computes, never by how the quad reaches the frame.
 */
export const QUAD_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  // The quad already spans clip space, so no projection is needed — and skipping it means the
  // pass draws the same way whatever camera the viewport happens to hold.
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`
