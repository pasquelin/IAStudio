/**
 * Every effect that is a FUNCTION OF ONE PIXEL, written as something the fuser can merge.
 *
 * An effect belongs here when it reads the picture at one place and nowhere else. That is what
 * lets six of them cost one draw instead of six — see `fuseShader`, which says why that matters
 * more than anything else in this folder.
 */
import { Vector2, type IUniform } from 'three'
import type { PostParamValue } from '@shared/domain/postProcessing'
import type { FusableChunk, FusableKind } from '../fuseShader'
import type { ViewInfo } from '../effectInstance'

export type Params = Readonly<Record<string, PostParamValue>>

/**
 * One fusable effect: how to build its chunk, and how to move its values into the uniforms the
 * fused shader was compiled with.
 *
 * `apply` receives the uniforms under the effect's OWN names — the fuser's renaming is undone for
 * it, so a chunk never has to know it was merged with anything.
 */
export type FusableEffect = {
  /** Whether it moves the coordinate before the single fetch, or works on the colour after it. */
  kind: FusableKind
  make: () => Omit<FusableChunk, 'kind'>
  apply: (params: Params, view: ViewInfo, uniforms: Record<string, IUniform>) => void
}

const asNumber = (value: PostParamValue | undefined, fallback = 0): number =>
  typeof value === 'number' ? value : fallback

const write = (uniforms: Record<string, IUniform>, name: string, value: number): void => {
  const uniform = uniforms[name]
  if (uniform) uniform.value = value
}

const writeSize = (uniforms: Record<string, IUniform>, name: string, view: ViewInfo): void => {
  const uniform = uniforms[name]
  if (uniform?.value instanceof Vector2) uniform.value.set(view.width, view.height)
}

/** Barrel and pincushion, and the zoom that puts the corners back inside the frame. */
const lensDistortion: FusableEffect = {
  kind: 'uv',
  make: () => ({
    uniforms: {
      distortion: { value: 0.1 },
      quartic: { value: 0 },
      zoom: { value: 1 },
      aspect: { value: 1 },
    },
    body: `
    vec2 centred = (uv - 0.5) / max(zoom, 0.001);
    vec2 scaled = vec2(centred.x * aspect, centred.y);
    float radius = dot(scaled, scaled);
    uv = centred * (1.0 + distortion * radius + quartic * radius * radius) + 0.5;
    mask *= step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    `,
  }),
  apply: (params, view, uniforms) => {
    write(uniforms, 'distortion', asNumber(params.distortion))
    write(uniforms, 'quartic', asNumber(params.quartic))
    write(uniforms, 'zoom', asNumber(params.zoom, 1))
    write(uniforms, 'aspect', view.height === 0 ? 1 : view.width / view.height)
  },
}

/** Blocks of `size` device pixels, snapped so the grid does not crawl when the view resizes. */
const pixelate: FusableEffect = {
  kind: 'uv',
  make: () => ({
    uniforms: { size: { value: 6 }, resolution: { value: new Vector2(1, 1) } },
    body: `
    vec2 blocks = max(resolution / max(size, 1.0), vec2(1.0));
    uv = (floor(uv * blocks) + 0.5) / blocks;
    `,
  }),
  apply: (params, view, uniforms) => {
    write(uniforms, 'size', asNumber(params.size, 1))
    writeSize(uniforms, 'resolution', view)
  },
}

/**
 * One grade, ten knobs, one draw.
 *
 * Twelve separate colour effects would be twelve full frames of bandwidth for arithmetic that is
 * a few dozen instructions. Every colour control the studio offers is therefore in this chunk.
 *
 * It runs in LINEAR light — the output pass is what brings the frame down to a screen — so the
 * contrast pivot is the linear mid grey, 0.18. Pivoted at a half it would crush everything.
 */
const colorGrading: FusableEffect = {
  kind: 'colour',
  make: () => ({
    uniforms: {
      exposure: { value: 0 },
      contrast: { value: 1 },
      saturation: { value: 1 },
      vibrance: { value: 0 },
      temperature: { value: 0 },
      tint: { value: 0 },
      hue: { value: 0 },
      gamma: { value: 1 },
      lift: { value: 0 },
      gain: { value: 1 },
    },
    helpers: [
      `
    vec3 turnHue(vec3 source, float radians) {
      float c = cos(radians);
      float s = sin(radians);
      mat3 toYiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
      mat3 fromYiq = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
      vec3 yiq = toYiq * source;
      return fromYiq * vec3(yiq.x, yiq.y * c - yiq.z * s, yiq.y * s + yiq.z * c);
    }
    `,
    ],
    body: `
    colour *= exp2(exposure);
    colour.r *= 1.0 + temperature * 0.25 + tint * 0.1;
    colour.g *= 1.0 - tint * 0.2;
    colour.b *= 1.0 - temperature * 0.25 + tint * 0.1;
    colour = max(colour * gain + lift, vec3(0.0));
    colour = pow(colour, vec3(1.0 / max(gamma, 0.001)));
    colour = max((colour - 0.18) * contrast + 0.18, vec3(0.0));
    float grey = luma(colour);
    colour = mix(vec3(grey), colour, saturation);
    float peak = max(colour.r, max(colour.g, colour.b));
    float spread = peak - min(colour.r, min(colour.g, colour.b));
    colour = mix(vec3(grey), colour, 1.0 + vibrance * (1.0 - spread / max(peak, 0.0001)));
    colour = mix(colour, turnHue(colour, hue), step(0.0001, abs(hue)));
    `,
  }),
  apply: (params, _view, uniforms) => {
    write(uniforms, 'exposure', asNumber(params.exposure))
    write(uniforms, 'contrast', asNumber(params.contrast, 1))
    write(uniforms, 'saturation', asNumber(params.saturation, 1))
    write(uniforms, 'vibrance', asNumber(params.vibrance))
    write(uniforms, 'temperature', asNumber(params.temperature))
    write(uniforms, 'tint', asNumber(params.tint))
    // Degrees on the panel, radians in the shader: an angle a person types is in degrees.
    write(uniforms, 'hue', (asNumber(params.hue) * Math.PI) / 180)
    write(uniforms, 'gamma', asNumber(params.gamma, 1))
    write(uniforms, 'lift', asNumber(params.lift))
    write(uniforms, 'gain', asNumber(params.gain, 1))
  },
}

const vignette: FusableEffect = {
  kind: 'colour',
  make: () => ({
    uniforms: { offset: { value: 1 }, darkness: { value: 1 } },
    body: `
    vec2 corner = (vUv - 0.5) * vec2(offset);
    colour *= clamp(pow(clamp(1.0 - dot(corner, corner), 0.0, 1.0), darkness), 0.0, 1.0);
    `,
  }),
  apply: (params, _view, uniforms) => {
    write(uniforms, 'offset', asNumber(params.offset, 1))
    write(uniforms, 'darkness', asNumber(params.darkness, 1))
  },
}

/**
 * Colour reduced to `levels` steps per channel, quantised through a display transfer rather than
 * in linear light: linear steps put almost every band in the shadows, where the eye can least use
 * them, and the result reads as broken rather than as posterised.
 */
const posterize: FusableEffect = {
  kind: 'colour',
  make: () => ({
    uniforms: { levels: { value: 8 } },
    body: `
    vec3 shown = pow(max(colour, vec3(0.0)), vec3(1.0 / 2.2));
    colour = pow(floor(shown * levels + 0.5) / levels, vec3(2.2));
    `,
  }),
  apply: (params, _view, uniforms) => write(uniforms, 'levels', asNumber(params.levels, 8)),
}

/** An ordered 4×4 Bayer dither — ordered rather than random, so it does not shimmer per frame. */
const dither: FusableEffect = {
  kind: 'colour',
  make: () => ({
    uniforms: {
      amount: { value: 0.5 },
      levels: { value: 8 },
      resolution: { value: new Vector2(1, 1) },
    },
    helpers: [
      `
    float bayer(vec2 pixel) {
      vec2 cell = floor(pixel);
      float a = mod(cell.x, 2.0) + 2.0 * mod(cell.y, 2.0);
      float b = mod(floor(cell.x * 0.5), 2.0) + 2.0 * mod(floor(cell.y * 0.5), 2.0);
      return (a * 4.0 + b) / 16.0 - 0.5;
    }
    `,
    ],
    body: `
    vec3 shown = pow(max(colour, vec3(0.0)), vec3(1.0 / 2.2));
    vec3 noised = shown + bayer(vUv * resolution) * amount / levels;
    colour = pow(clamp(floor(noised * levels + 0.5) / levels, 0.0, 1.0), vec3(2.2));
    `,
  }),
  apply: (params, view, uniforms) => {
    write(uniforms, 'amount', asNumber(params.amount, 0.5))
    write(uniforms, 'levels', asNumber(params.levels, 8))
    writeSize(uniforms, 'resolution', view)
  },
}

/**
 * Emulsion grain.
 *
 * Two things separate it from plain noise: it is strongest in the mid-tones, where silver halide
 * actually varies, and its seed moves with time — grain that stands still reads as dirt on the
 * sensor rather than as film.
 */
const filmGrain: FusableEffect = {
  kind: 'colour',
  make: () => ({
    uniforms: {
      intensity: { value: 0.3 },
      grainSize: { value: 1 },
      seed: { value: 0 },
      resolution: { value: new Vector2(1, 1) },
    },
    body: `
    vec2 grid = floor(vUv * resolution / max(grainSize, 0.001));
    float level = clamp(luma(colour), 0.0, 1.0);
    colour += (hash(grid + seed) - 0.5) * intensity * 4.0 * level * (1.0 - level);
    `,
  }),
  apply: (params, view, uniforms) => {
    write(uniforms, 'intensity', asNumber(params.intensity, 0.3))
    write(uniforms, 'grainSize', asNumber(params.size, 1))
    // Frozen where the person asked for still grain, rather than not drawn: a still frame of a
    // film has grain, it just does not crawl.
    write(uniforms, 'seed', params.animated === false ? 0 : view.time % 1)
    writeSize(uniforms, 'resolution', view)
  },
}

/** Horizontal lines, COUNTED rather than measured in pixels: a look survives a resize. */
const scanlines: FusableEffect = {
  kind: 'colour',
  make: () => ({
    uniforms: { intensity: { value: 0.3 }, count: { value: 720 } },
    body: `
    float line = sin(vUv.y * count * 3.14159265);
    colour *= 1.0 - intensity * 0.5 * (1.0 - line * line);
    `,
  }),
  apply: (params, _view, uniforms) => {
    write(uniforms, 'intensity', asNumber(params.intensity, 0.3))
    write(uniforms, 'count', asNumber(params.count, 720))
  },
}

/** A rotated dot grid modulating the luminance — the newsprint screen, in one pixel's worth. */
const dotScreen: FusableEffect = {
  kind: 'colour',
  make: () => ({
    uniforms: {
      scale: { value: 0.8 },
      angle: { value: 1.57 },
      resolution: { value: new Vector2(1, 1) },
    },
    body: `
    vec2 at = (vUv - 0.5) * resolution * scale;
    float c = cos(angle);
    float s = sin(angle);
    vec2 turned = vec2(at.x * c - at.y * s, at.x * s + at.y * c);
    float pattern = sin(turned.x) * sin(turned.y);
    colour = vec3(clamp(luma(colour) * 10.0 - 5.0 + pattern, 0.0, 1.0));
    `,
  }),
  apply: (params, view, uniforms) => {
    write(uniforms, 'scale', asNumber(params.scale, 0.8))
    write(uniforms, 'angle', asNumber(params.angle, 1.57))
    writeSize(uniforms, 'resolution', view)
  },
}

/**
 * Which effects fuse. Everything absent from this table keeps a pass of its own, and `postPlan`
 * reads exactly this to decide where a run of fused effects begins and ends.
 */
export const FUSABLE_EFFECTS: Readonly<Record<string, FusableEffect>> = {
  lensDistortion,
  pixelate,
  colorGrading,
  vignette,
  posterize,
  dither,
  filmGrain,
  scanlines,
  dotScreen,
}
