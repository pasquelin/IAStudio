/**
 * The GLSL every off-screen pass over a channel shares. Written once because the two that read
 * a base colour have to read it the same way: the weights are what decides what the relief
 * looks like, and a second copy would be free to drift.
 */

/** What every pass is handed: the channel, one texel of it, and where in it this pixel sits. */
export const SOURCE_PREAMBLE = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
varying vec2 vUv;
`

/** Rec. 709, the same weights the grading pass uses. */
export const LUMA = /* glsl */ `const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);`
