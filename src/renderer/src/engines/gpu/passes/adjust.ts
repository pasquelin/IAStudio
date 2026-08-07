import { ShaderMaterial, type Texture } from 'three'
import type { AdjustmentStack } from '@shared/domain/adjustments'

/**
 * Colour grading, in one shader, for every workspace that grades. Uniforms only: nothing here
 * ever writes a pixel to disk, which is what makes an adjustment free to change and free to
 * undo — and what a competitor charges another generation for.
 */

const TWO_PI = Math.PI * 2

/** How far a full swing of the temperature or tint slider pushes a channel. */
const TEMPERATURE_GAIN = 0.25
const TINT_GAIN = 0.15

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  // The quad already spans clip space, so no projection is needed — and skipping it means the
  // pass draws the same way whatever camera the viewport happens to hold.
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uSource;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uTemperature;
uniform float uTint;
uniform float uOffsetU;

varying vec2 vUv;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

// Middle grey in linear light. Pivoting contrast around 0.5 would be pivoting around a value
// that is nearly white once the source has been decoded out of sRGB.
const float PIVOT = 0.18;

void main() {
  // Only the horizontal wraps: on an equirectangular picture that is the horizon turning, and
  // it is seamless. Wrapping vertically would fold the sky through the ground.
  vec2 uv = vec2(fract(vUv.x + uOffsetU), vUv.y);
  vec3 color = texture2D(uSource, uv).rgb;

  color *= uExposure;

  color.r *= 1.0 + uTemperature;
  color.b *= 1.0 - uTemperature;
  color.g *= 1.0 - uTint;

  color = (color - PIVOT) * uContrast + PIVOT;

  // After contrast, so desaturating a hardened image gives the greys that image really has.
  float luma = dot(color, LUMA);
  color = mix(vec3(luma), color, uSaturation);

  // Negatives are possible once contrast has pushed darks below the pivot, and a negative
  // channel feeding the prefiltered map lights the scene with anti-light.
  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

/**
 * The uniform objects themselves, held by name rather than reached through
 * `material.uniforms`. That dictionary is keyed by string, so every read of it is possibly
 * undefined — and a typo in one would be a silent no-op rather than a compile error.
 */
type AdjustUniforms = {
  uSource: { value: Texture | null }
  uExposure: { value: number }
  uContrast: { value: number }
  uSaturation: { value: number }
  uTemperature: { value: number }
  uTint: { value: number }
  uOffsetU: { value: number }
}

export type AdjustPass = {
  readonly material: ShaderMaterial
  readonly uniforms: AdjustUniforms
  setSource: (texture: Texture | null) => void
  setAdjustments: (stack: AdjustmentStack) => void
  dispose: () => void
}

/**
 * The uniforms a stack becomes. Separate from the material so the two conversions that are not
 * identities — stops into a multiplier, radians into a texture offset — can be tested without
 * a GL context.
 */
export function adjustUniformsOf(stack: AdjustmentStack): {
  exposure: number
  contrast: number
  saturation: number
  temperature: number
  tint: number
  offsetU: number
} {
  return {
    // Stops are doublings, which is what makes +1 EV mean "twice the light" rather than "one
    // more unit of it".
    exposure: 2 ** stack.exposure,
    contrast: stack.contrast,
    saturation: stack.saturation,
    temperature: stack.temperature * TEMPERATURE_GAIN,
    tint: stack.tint * TINT_GAIN,
    // A full turn is the whole width of an equirectangular picture.
    offsetU: stack.rotationY / TWO_PI,
  }
}

export function createAdjustPass(): AdjustPass {
  const uniforms: AdjustUniforms = {
    uSource: { value: null },
    uExposure: { value: 1 },
    uContrast: { value: 1 },
    uSaturation: { value: 1 },
    uTemperature: { value: 0 },
    uTint: { value: 0 },
    uOffsetU: { value: 0 },
  }

  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
  })

  return {
    material,
    uniforms,

    setSource: texture => {
      uniforms.uSource.value = texture
    },

    setAdjustments: stack => {
      const next = adjustUniformsOf(stack)
      uniforms.uExposure.value = next.exposure
      uniforms.uContrast.value = next.contrast
      uniforms.uSaturation.value = next.saturation
      uniforms.uTemperature.value = next.temperature
      uniforms.uTint.value = next.tint
      uniforms.uOffsetU.value = next.offsetU
    },

    dispose: () => material.dispose(),
  }
}
