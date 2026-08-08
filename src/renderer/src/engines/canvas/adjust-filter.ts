import { defaultFilterVert, Filter } from 'pixi.js'
import type { AdjustmentStack } from '@shared/domain/adjustments'

/**
 * Colour grading as one filter pass. The GLSL is the one `engines/gpu/passes/adjust.ts` grades
 * skies and textures with; only the wrapper differs, because that one is a three.js
 * `ShaderMaterial` and the canvas is Pixi.
 *
 * A description, never pixels: the values travel with the document, the GPU applies them on the
 * way to the screen, and no layer is ever rewritten — which is what makes an adjustment free to
 * change and free to undo.
 */
const FRAGMENT = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uTemperature;
uniform float uTint;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

// Middle grey in linear light. Pivoting contrast around 0.5 would be pivoting around a value
// that is nearly white once the source has been decoded out of sRGB.
const float PIVOT = 0.18;

void main(void) {
  vec4 source = texture(uTexture, vTextureCoord);
  // Straight alpha to grade on: the filter reads premultiplied pixels, and grading those
  // brightens the edges of a stroke more than its middle.
  vec3 color = source.a > 0.0 ? source.rgb / source.a : source.rgb;

  color *= uExposure;

  color.r *= 1.0 + uTemperature;
  color.b *= 1.0 - uTemperature;
  color.g *= 1.0 - uTint;

  color = (color - PIVOT) * uContrast + PIVOT;

  // After contrast, so desaturating a hardened image gives the greys that image really has.
  float luma = dot(color, LUMA);
  color = mix(vec3(luma), color, uSaturation);

  color = max(color, vec3(0.0));
  finalColor = vec4(color * source.a, source.a);
}
`

/** How far a full swing of the temperature or tint slider pushes a channel. */
const TEMPERATURE_GAIN = 0.25
const TINT_GAIN = 0.15

export type AdjustFilter = Filter & {
  /** Pushes a stack into the pass. Uniforms only: nothing is rebuilt, nothing is reallocated. */
  grade: (values: AdjustmentStack) => void
}

export function createAdjustFilter(): AdjustFilter {
  const filter = Filter.from({
    // Pixi's own: it places the pass on the output frame, which is the half nobody should
    // rewrite. Only the fragment is ours.
    gl: { vertex: defaultFilterVert, fragment: FRAGMENT },
    resources: {
      adjustUniforms: {
        uExposure: { value: 1, type: 'f32' },
        uContrast: { value: 1, type: 'f32' },
        uSaturation: { value: 1, type: 'f32' },
        uTemperature: { value: 0, type: 'f32' },
        uTint: { value: 0, type: 'f32' },
      },
    },
  })

  const grade = (values: AdjustmentStack): void => {
    const uniforms = filter.resources.adjustUniforms?.uniforms
    if (!uniforms) return

    // Stops, so 0 is untouched and every step doubles — the unit a photographer already thinks in.
    uniforms.uExposure = 2 ** values.exposure
    uniforms.uContrast = values.contrast
    uniforms.uSaturation = values.saturation
    uniforms.uTemperature = values.temperature * TEMPERATURE_GAIN
    uniforms.uTint = values.tint * TINT_GAIN
  }

  return Object.assign(filter, { grade })
}
