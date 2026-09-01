import { LUMA } from '@/engines/material/derive/glsl'

/** `LUMA` is the studio's own constant, not a fourth copy: four passes read a luminance alike. */
export const PRELUDE = /* glsl */ `
${LUMA}

float hash(vec2 at) {
  return fract(sin(dot(at, vec2(12.9898, 78.233))) * 43758.5453);
}
`

/** Middle grey in LINEAR light — the pivot `gpu/passes/adjust` grades around, for one reason. */
export const PIVOT = '0.18'
