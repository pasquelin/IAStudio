import { defaultFilterVert, Filter } from 'pixi.js'
import { adjustUniformsOf, type AdjustmentStack } from '@shared/domain/adjustments'
// The weights themselves, read rather than written a third time: this pass, the three.js one and
// the texture chunks all declared the same three numbers.
import { LUMA } from '@/engines/material/derive/glsl'

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

${LUMA}

// Middle grey in sRGB, which is what a layer's texture holds. The three.js pass grades linear
// light and pivots at 0.18; pivoting there on sRGB pixels brightens the whole picture instead
// of hardening it.
const float PIVOT = 0.5;

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

    // The same conversion the three.js pass applies — stops into a multiplier, a slider swing
    // into a channel push. Shared rather than repeated: two copies of a grading contract drift.
    const graded = adjustUniformsOf(values)
    uniforms.uExposure = graded.exposure
    uniforms.uContrast = graded.contrast
    uniforms.uSaturation = graded.saturation
    uniforms.uTemperature = graded.temperature
    uniforms.uTint = graded.tint
  }

  return Object.assign(filter, { grade })
}
