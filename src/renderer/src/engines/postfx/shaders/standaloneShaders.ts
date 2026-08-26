/**
 * The effects that read the picture at MORE THAN ONE PLACE, and so cannot fuse. Each costs a
 * full frame of bandwidth — which is why the tube and the tape are one shader apiece.
 */
import { Color, Vector2 } from 'three'
import { QUAD_VERTEX_SHADER } from '@/engines/gpu/passes/quad'
import { PRELUDE } from './postGlsl'

/**
 * `radial` is what makes it a LENS defect: the offset grows away from the centre, so the middle
 * of the frame stays clean. Off, it is the flat sideways shift of a video artefact.
 */
export const chromaticAberrationShader = {
  name: 'ChromaticAberrationShader',
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.003 },
    radial: { value: 1 },
  },
  vertexShader: QUAD_VERTEX_SHADER,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform float radial;
    varying vec2 vUv;

    void main() {
      vec2 offset = mix(vec2(amount, 0.0), (vUv - 0.5) * amount * 2.0, radial);
      vec4 mid = texture2D(tDiffuse, vUv);

      gl_FragColor = vec4(
        texture2D(tDiffuse, vUv + offset).r,
        mid.g,
        texture2D(tDiffuse, vUv - offset).b,
        mid.a
      );
    }
  `,
}

/** An unsharp mask over the four neighbours. `texel` is one pixel of the pass, in UV. */
export const sharpenShader = {
  name: 'SharpenShader',
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.5 },
    texel: { value: new Vector2() },
  },
  vertexShader: QUAD_VERTEX_SHADER,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform vec2 texel;
    varying vec2 vUv;

    void main() {
      vec4 centre = texture2D(tDiffuse, vUv);
      vec3 around =
        texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb +
        texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb +
        texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb +
        texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb;

      gl_FragColor = vec4(
        max(centre.rgb + (centre.rgb * 4.0 - around) * amount * 0.25, vec3(0.0)),
        centre.a
      );
    }
  `,
}

/**
 * One axis of a separable blur — nine taps twice rather than eighty-one once. `boxed` flattens
 * the weights rather than switching shader: a branch costs nothing beside nine fetches.
 */
export const blurAxisShader = {
  name: 'BlurAxisShader',
  uniforms: {
    tDiffuse: { value: null },
    radius: { value: 2 },
    direction: { value: new Vector2(1, 0) },
    texel: { value: new Vector2() },
    boxed: { value: 0 },
  },
  vertexShader: QUAD_VERTEX_SHADER,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float radius;
    uniform vec2 direction;
    uniform vec2 texel;
    uniform float boxed;
    varying vec2 vUv;

    void main() {
      vec2 stride = direction * texel * radius * 0.25;
      vec4 total = vec4(0.0);
      float weights = 0.0;

      for (int tap = -4; tap <= 4; tap += 1) {
        float offset = float(tap);
        float weight = mix(exp(-offset * offset / 8.0), 1.0, boxed);
        total += texture2D(tDiffuse, vUv + stride * offset) * weight;
        weights += weight;
      }

      gl_FragColor = total / weights;
    }
  `,
}

/**
 * Deliberately NOT `OutlinePass`: that one outlines a LIST OF OBJECTS, which would tie a
 * composition — and a film — to whatever happened to be selected.
 */
export const outlineShader = {
  name: 'OutlineShader',
  uniforms: {
    tDiffuse: { value: null },
    thickness: { value: 1 },
    threshold: { value: 0.1 },
    lineColour: { value: new Color(0, 0, 0) },
    opacity: { value: 1 },
    texel: { value: new Vector2() },
  },
  vertexShader: QUAD_VERTEX_SHADER,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float thickness;
    uniform float threshold;
    uniform vec3 lineColour;
    uniform float opacity;
    uniform vec2 texel;
    varying vec2 vUv;

    ${PRELUDE}

    float level(vec2 at) {
      return dot(texture2D(tDiffuse, at).rgb, LUMA);
    }

    void main() {
      vec4 here = texture2D(tDiffuse, vUv);
      vec2 stride = texel * thickness;

      float tl = level(vUv + vec2(-stride.x, stride.y));
      float tm = level(vUv + vec2(0.0, stride.y));
      float tr = level(vUv + stride);
      float ml = level(vUv + vec2(-stride.x, 0.0));
      float mr = level(vUv + vec2(stride.x, 0.0));
      float bl = level(vUv - stride);
      float bm = level(vUv - vec2(0.0, stride.y));
      float br = level(vUv + vec2(stride.x, -stride.y));

      float gx = tl + 2.0 * ml + bl - tr - 2.0 * mr - br;
      float gy = tl + 2.0 * tm + tr - bl - 2.0 * bm - br;
      float edge = smoothstep(threshold, threshold * 2.0 + 0.001, sqrt(gx * gx + gy * gy));

      gl_FragColor = vec4(mix(here.rgb, lineColour, edge * opacity), here.a);
    }
  `,
}

/** A cathode tube: curved glass, an aperture grille, beams that miss, and corners that fall away. */
export const crtShader = {
  name: 'CrtShader',
  uniforms: {
    tDiffuse: { value: null },
    curvature: { value: 0.25 },
    scanline: { value: 0.3 },
    aberration: { value: 0.002 },
    edgeFall: { value: 0.4 },
    resolution: { value: new Vector2(1, 1) },
  },
  vertexShader: QUAD_VERTEX_SHADER,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float curvature;
    uniform float scanline;
    uniform float aberration;
    uniform float edgeFall;
    uniform vec2 resolution;
    varying vec2 vUv;

    void main() {
      vec2 centred = vUv * 2.0 - 1.0;
      vec2 bent = centred * (1.0 + curvature * dot(centred.yx, centred.yx) * 0.25);
      vec2 at = bent * 0.5 + 0.5;
      float inside = step(0.0, at.x) * step(at.x, 1.0) * step(0.0, at.y) * step(at.y, 1.0);

      vec2 shift = (at - 0.5) * aberration * 2.0;
      vec4 mid = texture2D(tDiffuse, clamp(at, 0.0, 1.0));
      vec3 colour = vec3(
        texture2D(tDiffuse, clamp(at + shift, 0.0, 1.0)).r,
        mid.g,
        texture2D(tDiffuse, clamp(at - shift, 0.0, 1.0)).b
      );

      float line = sin(at.y * resolution.y * 3.14159265);
      colour *= 1.0 - scanline * 0.5 * (1.0 - line * line);
      colour *= 1.0 - edgeFall * dot(bent, bent) * 0.35;

      gl_FragColor = vec4(max(colour * inside, vec3(0.0)), mid.a);
    }
  `,
}

/**
 * The bleed touches the colour DIFFERENCE and not the luminance, which is what a composite
 * recording loses — smeared together they would only look out of focus.
 */
export const vhsShader = {
  name: 'VhsShader',
  uniforms: {
    tDiffuse: { value: null },
    bleed: { value: 0.006 },
    jitter: { value: 0.004 },
    noise: { value: 0.15 },
    bands: { value: 0.3 },
    seed: { value: 0 },
  },
  vertexShader: QUAD_VERTEX_SHADER,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float bleed;
    uniform float jitter;
    uniform float noise;
    uniform float bands;
    uniform float seed;
    varying vec2 vUv;

    ${PRELUDE}

    void main() {
      float line = hash(vec2(floor(vUv.y * 480.0), floor(seed * 24.0)));
      vec2 at = clamp(vec2(vUv.x + (line - 0.5) * jitter, vUv.y), 0.0, 1.0);

      vec3 mid = texture2D(tDiffuse, at).rgb;
      vec3 left = texture2D(tDiffuse, clamp(at - vec2(bleed, 0.0), 0.0, 1.0)).rgb;
      vec3 right = texture2D(tDiffuse, clamp(at + vec2(bleed, 0.0), 0.0, 1.0)).rgb;

      vec3 smeared = (left + right) * 0.5;
      vec3 colour = vec3(dot(mid, LUMA)) + (smeared - vec3(dot(smeared, LUMA)));

      float band = smoothstep(0.0, 0.06, abs(fract(vUv.y + seed * 0.12) - 0.5) - 0.44);
      colour = mix(colour, colour * 0.55 + 0.12, band * bands);
      colour += (hash(vUv * 900.0 + seed) - 0.5) * noise * 0.4;

      gl_FragColor = vec4(max(colour, vec3(0.0)), 1.0);
    }
  `,
}

/**
 * The dash, the boost, the hit: everything smears towards one point. `hole` is what keeps the
 * subject at that point readable — the smear starts past it rather than at it.
 */
export const radialBlurShader = {
  name: 'RadialBlurShader',
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.25 },
    centre: { value: new Vector2(0.5, 0.5) },
    hole: { value: 0.1 },
    taps: { value: 16 },
  },
  vertexShader: QUAD_VERTEX_SHADER,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform vec2 centre;
    uniform float hole;
    uniform float taps;
    varying vec2 vUv;

    // GLSL ES 1.0 wants a constant bound, so the count is a uniform the loop breaks on.
    const int MAX_TAPS = 32;

    void main() {
      vec2 towards = vUv - centre;
      // Nothing moves inside the hole, and the smear eases in rather than starting at full
      // length: a hard edge around the subject reads as a circle drawn on the picture.
      float reach = amount * smoothstep(hole, 1.0, length(towards) * 2.0);

      vec3 sum = vec3(0.0);
      float weight = 0.0;
      for (int i = 0; i < MAX_TAPS; i += 1) {
        if (float(i) >= taps) break;
        float step = float(i) / max(taps - 1.0, 1.0);
        sum += texture2D(tDiffuse, clamp(vUv - towards * reach * step, 0.0, 1.0)).rgb;
        weight += 1.0;
      }

      gl_FragColor = vec4(sum / max(weight, 1.0), 1.0);
    }
  `,
}

/**
 * The painterly filter: each pixel takes the mean of whichever of its four quadrants varies
 * LEAST, which flattens the inside of a shape while leaving its border alone.
 *
 * Four quadrants rather than the anisotropic form — eight sectors weighted by a structure tensor
 * would be four more fetch loops for a difference this studio has nowhere to judge.
 */
export const kuwaharaShader = {
  name: 'KuwaharaShader',
  uniforms: {
    tDiffuse: { value: null },
    radius: { value: 3 },
    texel: { value: new Vector2() },
  },
  vertexShader: QUAD_VERTEX_SHADER,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float radius;
    uniform vec2 texel;
    varying vec2 vUv;

    ${PRELUDE}

    const int MAX_RADIUS = 6;

    void main() {
      vec3 bestMean = texture2D(tDiffuse, vUv).rgb;
      float bestSpread = 1.0e9;

      for (int quadrant = 0; quadrant < 4; quadrant += 1) {
        vec2 way = vec2(quadrant == 0 || quadrant == 3 ? 1.0 : -1.0,
                        quadrant < 2 ? 1.0 : -1.0);

        vec3 sum = vec3(0.0);
        vec3 squares = vec3(0.0);
        float count = 0.0;

        for (int y = 0; y <= MAX_RADIUS; y += 1) {
          if (float(y) > radius) break;
          for (int x = 0; x <= MAX_RADIUS; x += 1) {
            if (float(x) > radius) break;
            vec3 seen = texture2D(
              tDiffuse,
              clamp(vUv + vec2(float(x), float(y)) * way * texel, 0.0, 1.0)
            ).rgb;
            sum += seen;
            squares += seen * seen;
            count += 1.0;
          }
        }

        vec3 mean = sum / count;
        // The variance of the LUMA rather than of each channel: a quadrant chosen per channel
        // takes three different neighbourhoods and paints the seams between them.
        float spread = dot(squares / count - mean * mean, LUMA);
        if (spread < bestSpread) {
          bestSpread = spread;
          bestMean = mean;
        }
      }

      gl_FragColor = vec4(bestMean, 1.0);
    }
  `,
}
