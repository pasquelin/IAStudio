/**
 * The GLSL every off-screen pass over a channel shares. Written once because the two that read
 * a base colour have to read it the same way: the weights are what decides what the relief
 * looks like, and a second copy would be free to drift.
 */

/**
 * What every fragment shader of the studio opens with: the precision it computes at, and where
 * in the frame this pixel sits. A pass that reads several channels declares its own samplers —
 * which is the whole of what it does not share with the ones that read one.
 */
export const PIXEL_PREAMBLE = /* glsl */ `
precision highp float;
varying vec2 vUv;
`

/** What a pass over one channel is handed: the channel, and one texel of it. */
export const SOURCE_PREAMBLE = /* glsl */ `
${PIXEL_PREAMBLE}
uniform sampler2D uSource;
uniform vec2 uTexel;
`

/** Rec. 709, the same weights the grading pass uses. */
export const LUMA = /* glsl */ `const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);`
