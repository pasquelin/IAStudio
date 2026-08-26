/**
 * The vertex shader every full-frame pass shares — the one three.js writes at the head of each of
 * its own post shaders. Written once here rather than copied into a dozen files, where a typo
 * would show up as one effect drawing nothing and the others working.
 */
export const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/**
 * Declared ONCE at the head of a fused shader, whatever it fuses — never renamed per instance.
 *
 * `luma` is Rec. 709 in LINEAR light, which is what a pass reads before the output pass brings
 * the frame down to a screen. `hash` is the cheapest value noise that does not band.
 */
export const PRELUDE = /* glsl */ `
float luma(vec3 colour) {
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));
}

float hash(vec2 at) {
  return fract(sin(dot(at, vec2(12.9898, 78.233))) * 43758.5453);
}
`
