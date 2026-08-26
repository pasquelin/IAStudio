/**
 * The effects that read the picture at MORE THAN ONE PLACE, and therefore cannot be fused.
 *
 * Each one costs a full frame of bandwidth, so each one has to earn it. That is why the tube and
 * the tape are one shader apiece rather than four effects stacked: a curvature without its
 * matching vignette reads as a bug rather than as a screen, and the four together are one draw.
 */
import { Color, Vector2 } from 'three'
import { PRELUDE, QUAD_VERTEX } from './quadVertex'

/**
 * The colour fringing a lens leaves, the three wavelengths not focusing in one plane.
 *
 * `radial` is what makes it a LENS defect: the offset grows with the distance from the centre, so
 * the middle of the frame stays clean. Off, it is the flat sideways shift of a video artefact.
 */
export const chromaticAberrationShader = {
  name: 'ChromaticAberrationShader',
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.003 },
    radial: { value: 1 },
  },
  vertexShader: QUAD_VERTEX,
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
  vertexShader: QUAD_VERTEX,
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
 * One axis of a separable blur, worn by two passes — nine taps twice rather than eighty-one once,
 * which is the whole reason a Gaussian is affordable at all.
 *
 * `boxed` flattens the weights instead of switching shader: the kind only changes the weighting,
 * and a branch on a uniform costs nothing beside nine fetches.
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
  vertexShader: QUAD_VERTEX,
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
 * A Sobel edge on the luminance of the finished picture, drawn in the colour asked for.
 *
 * Deliberately NOT `OutlinePass`: that one outlines a LIST OF OBJECTS, which would tie a
 * composition to whatever happened to be selected — and make a film depend on it. An edge read
 * off the image is the same in the viewport, in the preview and in the render.
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
  vertexShader: QUAD_VERTEX,
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
      return luma(texture2D(tDiffuse, at).rgb);
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
  vertexShader: QUAD_VERTEX,
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
 * Tape: the chroma smears sideways, the line start wanders, and a head-switching band walks up
 * the picture.
 *
 * The bleed touches the colour DIFFERENCE and not the luminance, which is exactly what a
 * composite recording loses — smeared together they would only look out of focus.
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
  vertexShader: QUAD_VERTEX,
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
      vec3 colour = vec3(luma(mid)) + (smeared - vec3(luma(smeared)));

      float band = smoothstep(0.0, 0.06, abs(fract(vUv.y + seed * 0.12) - 0.5) - 0.44);
      colour = mix(colour, colour * 0.55 + 0.12, band * bands);
      colour += (hash(vUv * 900.0 + seed) - 0.5) * noise * 0.4;

      gl_FragColor = vec4(max(colour, vec3(0.0)), 1.0);
    }
  `,
}
