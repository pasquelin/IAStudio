import { ShaderMaterial, type Texture } from 'three'
import { adjustUniformsOf, type AdjustmentStack } from '@shared/domain/adjustments'
import { LUMA } from '@/engines/texture/derive/glsl'
import { QUAD_VERTEX_SHADER } from './quad'

/**
 * Colour grading, in one shader, for every workspace that grades. Uniforms only: nothing here
 * ever writes a pixel to disk, which is what makes an adjustment free to change and free to
 * undo — and what a competitor charges another generation for.
 */

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

${LUMA}

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
    vertexShader: QUAD_VERTEX_SHADER,
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
