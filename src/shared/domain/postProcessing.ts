/**
 * What a post-processing stack IS, and what every effect declares of itself.
 *
 * Data only, and deliberately: the catalogue is read by the renderer to build passes, by the MCP
 * registry to publish actions, and by the main process to validate an imported preset. None of
 * those may pull three.js in, so nothing here knows a `Pass` exists — `engines/postfx/` is the
 * one folder that does.
 */
import { isRecord, oneOf, readBoolean, readString } from '../guards'
import { bound } from '../numeric'
import type { FieldValue, PropertySpec } from './propertySpec'
import { isVector3 } from './transform'

/** What a parameter holds. The same four shapes the inspector already renders. */
export type PostParamValue = FieldValue

/**
 * One knob of one effect: how it is shown, what it opens on, and whether the timeline may drive
 * it.
 *
 * A colour is `animatable: false` in this version — a keyframe carries a `Vector3` and a colour
 * is stored as a hexadecimal string, so keying one would need a conversion at both ends that
 * nothing yet asks for.
 */
export type PostParamSpec = PropertySpec & { default: PostParamValue; animatable: boolean }

export type PostCategory =
  'lighting' | 'lens' | 'light' | 'color' | 'image' | 'film' | 'stylized' | 'aa'

export const POST_CATEGORIES: readonly PostCategory[] = [
  'lighting',
  'lens',
  'light',
  'color',
  'image',
  'film',
  'stylized',
  'aa',
]

/**
 * Where an effect is allowed to sit in the chain, and it is not a preference.
 *
 * `render` DRAWS the scene and replaces the plain render at the head — supersampling, and nothing
 * else. `ao` reads the depth and the normals of that render and must darken the picture before
 * anything spreads light around it; a bloom applied first would bloom light the occlusion was
 * about to remove. `aa` reads finished pixels and comes after everything that could introduce an
 * edge. Only `image` is free, and that band is the one the drag reorders.
 *
 * **`render` and `ao` are EXCLUSIVE**: two passes each drawing the scene would draw it twice to
 * throw one away, and two occlusions multiply into a picture nobody asked for.
 */
export type PostSlot = 'render' | 'ao' | 'image' | 'aa'

const SLOT_RANK: Record<PostSlot, number> = { render: 0, ao: 1, image: 2, aa: 3 }

/** The slots of which at most one is honoured — see `planStack`. */
const EXCLUSIVE: readonly PostSlot[] = ['render', 'ao']

/** Roughly what a pass costs, for the badge the library shows. Never used to decide anything. */
export type PostCost = 'low' | 'medium' | 'high'

export const POST_COSTS: readonly PostCost[] = ['low', 'medium', 'high']

export type PostEffectId =
  | 'gtao'
  | 'ssao'
  | 'ssaa'
  | 'bloom'
  | 'dof'
  | 'chromaticAberration'
  | 'lensDistortion'
  | 'heatHaze'
  | 'colorGrading'
  | 'lut'
  | 'sharpen'
  | 'blur'
  | 'radialBlur'
  | 'pixelate'
  | 'posterize'
  | 'dither'
  | 'vignette'
  | 'letterbox'
  | 'filmGrain'
  | 'scanlines'
  | 'outline'
  | 'halftone'
  | 'dotScreen'
  | 'kuwahara'
  | 'glitch'
  | 'rgbShift'
  | 'crt'
  | 'vhs'
  | 'fxaa'
  | 'smaa'

export type PostEffectMeta = {
  category: PostCategory
  cost: PostCost
  slot: PostSlot
  /** Whether two of them in one stack mean anything. An anti-aliaser twice does not. */
  duplicable: boolean
  /**
   * Whether it works ABOVE white — a bloom thresholds highlights, a defocus spreads them, an
   * opened exposure pulls values back from over one. On bytes all three read as clipping, so the
   * chain buys half-float for them. Declared here rather than named in the renderer: a thirtieth
   * HDR effect would otherwise draw into bytes and nothing would redden.
   */
  hdr?: boolean
  params: Readonly<Record<string, PostParamSpec>>
}

const slider = (
  min: number,
  max: number,
  step: number,
  value: number,
  animatable = true,
): PostParamSpec => ({ control: 'slider', min, max, step, default: value, animatable })

const number = (min: number, max: number, step: number, value: number): PostParamSpec => ({
  control: 'number',
  min,
  max,
  step,
  default: value,
  animatable: true,
})

const toggle = (value: boolean): PostParamSpec => ({
  control: 'toggle',
  default: value,
  animatable: false,
})

const colour = (value: string): PostParamSpec => ({
  control: 'color',
  default: value,
  animatable: false,
})

const choice = (options: readonly string[], value: string): PostParamSpec => ({
  control: 'choice',
  options,
  labelPrefix: 'postfx.option_',
  default: value,
  animatable: false,
})

const picture = (value = ''): PostParamSpec => ({
  control: 'asset',
  assetType: 'image',
  default: value,
  animatable: false,
})

export const HALFTONE_SHAPES: readonly string[] = ['dot', 'ellipse', 'line', 'square']
export const BLUR_KINDS: readonly string[] = ['gaussian', 'box']

/**
 * Every effect the studio knows, and everything a panel needs to draw one.
 *
 * A `Record` keyed on the union, so an effect added to `PostEffectId` fails to compile until it
 * has a fiche here — the same door `COVERAGE` holds for the MCP actions.
 */
export const POST_EFFECTS: Record<PostEffectId, PostEffectMeta> = {
  gtao: {
    category: 'lighting',
    cost: 'high',
    slot: 'ao',
    duplicable: false,
    params: {
      radius: slider(0.01, 2, 0.01, 0.25),
      distanceExponent: slider(0.5, 4, 0.1, 1),
      thickness: slider(0.1, 10, 0.1, 1),
      scale: slider(0.01, 4, 0.01, 1),
      samples: number(4, 32, 1, 16),
      blend: slider(0, 1, 0.01, 1),
    },
  },
  ssao: {
    category: 'lighting',
    cost: 'high',
    slot: 'ao',
    duplicable: false,
    params: {
      radius: slider(0.01, 32, 0.01, 8),
      minDistance: slider(0.0001, 0.02, 0.0001, 0.005),
      maxDistance: slider(0.01, 0.5, 0.01, 0.1),
    },
  },
  ssaa: {
    category: 'aa',
    cost: 'high',
    slot: 'render',
    duplicable: false,
    params: { level: number(1, 4, 1, 2) },
  },
  bloom: {
    hdr: true,
    category: 'light',
    cost: 'medium',
    slot: 'image',
    duplicable: true,
    params: {
      strength: slider(0, 4, 0.01, 0.6),
      radius: slider(0, 2, 0.01, 0.4),
      threshold: slider(0, 2, 0.01, 0.85),
    },
  },
  dof: {
    hdr: true,
    category: 'lens',
    cost: 'high',
    slot: 'image',
    duplicable: false,
    params: {
      focusDistance: number(0.01, 1000, 0.01, 10),
      aperture: slider(0.0001, 0.05, 0.0001, 0.005),
      maxBlur: slider(0, 0.05, 0.001, 0.01),
    },
  },
  chromaticAberration: {
    category: 'lens',
    cost: 'low',
    slot: 'image',
    duplicable: true,
    params: {
      amount: slider(0, 0.05, 0.0005, 0.003),
      radial: toggle(true),
    },
  },
  lensDistortion: {
    category: 'lens',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: {
      distortion: slider(-0.5, 0.5, 0.005, 0.1),
      quartic: slider(-0.5, 0.5, 0.005, 0),
      zoom: slider(0.5, 1.5, 0.01, 1),
    },
  },
  /** Rising air, a portal, under the water: the picture wobbles rather than the geometry. */
  heatHaze: {
    category: 'lens',
    cost: 'low',
    slot: 'image',
    duplicable: true,
    params: {
      amount: slider(0, 0.05, 0.001, 0.008),
      frequency: slider(1, 60, 0.5, 18),
      speed: slider(0, 8, 0.1, 1.4),
    },
  },
  colorGrading: {
    hdr: true,
    category: 'color',
    cost: 'low',
    slot: 'image',
    duplicable: true,
    params: {
      exposure: slider(-4, 4, 0.01, 0),
      contrast: slider(0, 2, 0.01, 1),
      saturation: slider(0, 2, 0.01, 1),
      vibrance: slider(-1, 1, 0.01, 0),
      temperature: slider(-1, 1, 0.01, 0),
      tint: slider(-1, 1, 0.01, 0),
      hue: slider(-180, 180, 1, 0),
      gamma: slider(0.1, 3, 0.01, 1),
      lift: slider(-0.5, 0.5, 0.01, 0),
      gain: slider(0, 2, 0.01, 1),
    },
  },
  lut: {
    category: 'color',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: {
      texture: picture(),
      intensity: slider(0, 1, 0.01, 1),
    },
  },
  sharpen: {
    category: 'image',
    cost: 'low',
    slot: 'image',
    duplicable: true,
    params: { amount: slider(0, 3, 0.01, 0.5) },
  },
  blur: {
    category: 'image',
    cost: 'medium',
    slot: 'image',
    duplicable: true,
    params: {
      kind: choice(BLUR_KINDS, 'gaussian'),
      radius: slider(0, 8, 0.1, 2),
    },
  },
  /** The dash, the boost, the hit: everything smears towards a point. `centre` is where. */
  radialBlur: {
    category: 'image',
    cost: 'medium',
    slot: 'image',
    duplicable: true,
    params: {
      amount: slider(0, 1, 0.01, 0.25),
      centreX: slider(0, 1, 0.01, 0.5),
      centreY: slider(0, 1, 0.01, 0.5),
      /** Where the smear STARTS, so a subject at the centre can stay readable through it. */
      hole: slider(0, 1, 0.01, 0.1),
      samples: number(4, 32, 1, 16),
    },
  },
  pixelate: {
    category: 'image',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: { size: number(1, 64, 1, 6) },
  },
  posterize: {
    category: 'image',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: { levels: number(2, 64, 1, 8) },
  },
  dither: {
    category: 'image',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: { amount: slider(0, 1, 0.01, 0.5), levels: number(2, 32, 1, 8) },
  },
  vignette: {
    category: 'film',
    cost: 'low',
    slot: 'image',
    duplicable: true,
    params: {
      offset: slider(0, 3, 0.01, 1),
      darkness: slider(0, 3, 0.01, 1),
    },
  },
  /** Cinematic bars, at the ratio a shot is framed for. Both axes: 4:3 on a wide view pillars. */
  letterbox: {
    category: 'film',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: {
      aspect: slider(1, 3, 0.01, 2.39),
      softness: slider(0, 0.05, 0.001, 0),
    },
  },
  filmGrain: {
    category: 'film',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: {
      intensity: slider(0, 1, 0.01, 0.3),
      size: slider(0.5, 4, 0.1, 1),
      /** Grain that stands still reads as dirt on the lens; grain that moves reads as film. */
      animated: toggle(true),
    },
  },
  scanlines: {
    category: 'film',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: {
      intensity: slider(0, 1, 0.01, 0.3),
      count: number(64, 4096, 1, 720),
    },
  },
  outline: {
    category: 'stylized',
    cost: 'medium',
    slot: 'image',
    duplicable: false,
    params: {
      thickness: slider(0.5, 4, 0.1, 1),
      threshold: slider(0, 1, 0.005, 0.1),
      colour: colour('#000000'),
      opacity: slider(0, 1, 0.01, 1),
    },
  },
  halftone: {
    category: 'stylized',
    cost: 'medium',
    slot: 'image',
    duplicable: false,
    params: {
      shape: choice(HALFTONE_SHAPES, 'dot'),
      radius: slider(1, 20, 0.5, 4),
      scatter: slider(0, 1, 0.01, 0),
      blending: slider(0, 1, 0.01, 1),
    },
  },
  dotScreen: {
    category: 'stylized',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: {
      scale: slider(0.1, 4, 0.05, 0.8),
      angle: slider(0, 6.28, 0.01, 1.57),
    },
  },
  /** The painterly filter: each pixel takes the mean of whichever quadrant varies least. */
  kuwahara: {
    category: 'stylized',
    cost: 'high',
    slot: 'image',
    duplicable: false,
    params: { radius: number(1, 6, 1, 3) },
  },
  glitch: {
    category: 'stylized',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: { wild: toggle(false) },
  },
  rgbShift: {
    category: 'stylized',
    cost: 'low',
    slot: 'image',
    duplicable: true,
    params: {
      amount: slider(0, 0.05, 0.0005, 0.0015),
      angle: slider(0, 6.28, 0.01, 0),
    },
  },
  crt: {
    category: 'stylized',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: {
      curvature: slider(0, 1, 0.01, 0.25),
      scanline: slider(0, 1, 0.01, 0.3),
      aberration: slider(0, 0.02, 0.0005, 0.002),
      vignette: slider(0, 1, 0.01, 0.4),
    },
  },
  vhs: {
    category: 'stylized',
    cost: 'low',
    slot: 'image',
    duplicable: false,
    params: {
      bleed: slider(0, 0.05, 0.0005, 0.006),
      jitter: slider(0, 0.05, 0.0005, 0.004),
      noise: slider(0, 1, 0.01, 0.15),
      bands: slider(0, 1, 0.01, 0.3),
    },
  },
  fxaa: {
    category: 'aa',
    cost: 'low',
    slot: 'aa',
    duplicable: false,
    params: {},
  },
  smaa: {
    category: 'aa',
    cost: 'medium',
    slot: 'aa',
    duplicable: false,
    params: {},
  },
}

export const POST_EFFECT_IDS: readonly PostEffectId[] = Object.keys(
  POST_EFFECTS,
) as readonly PostEffectId[]

export function isPostEffectId(value: unknown): value is PostEffectId {
  return typeof value === 'string' && value in POST_EFFECTS
}

/** One effect placed in a stack. `id` is the INSTANCE — what a keyframe aims at. */
export type PostEffect = {
  id: string
  effect: PostEffectId
  enabled: boolean
  params: Readonly<Record<string, PostParamValue>>
}

/**
 * An ordered composition. `enabled` is the ON/OFF the whole panel offers — turning it off leaves
 * every effect and every parameter exactly where they were, which is what makes it a comparison
 * rather than an edit.
 */
export type PostStack = {
  enabled: boolean
  effects: readonly PostEffect[]
}

export const EMPTY_STACK: PostStack = Object.freeze({ enabled: true, effects: [] })

/**
 * What a camera does about the scene's composition.
 *
 * Absent on every camera ever written, and absent means `inherit` — that IS the migration, and
 * `postOf` is the one place that says so.
 */
export type CameraPost =
  { mode: 'inherit' } | { mode: 'disabled' } | { mode: 'override'; stack: PostStack }

export type CameraPostMode = CameraPost['mode']

/** The stack a camera OWNS — `null` while it inherits the scene's or films through none. */
export function ownedStackOf(post: CameraPost | undefined): PostStack | null {
  return post?.mode === 'override' ? post.stack : null
}

export const CAMERA_POST_MODES: readonly CameraPostMode[] = ['inherit', 'override', 'disabled']

const INHERIT_POST: CameraPost = Object.freeze({ mode: 'inherit' })

/** The values a fresh instance of this effect opens on. */
export function defaultParamsOf(effect: PostEffectId): Record<string, PostParamValue> {
  return Object.fromEntries(
    Object.entries(POST_EFFECTS[effect].params).map(([key, spec]) => [key, spec.default]),
  )
}

export function postEffect(id: string, effect: PostEffectId): PostEffect {
  return { id, effect, enabled: true, params: defaultParamsOf(effect) }
}

/**
 * What the stack really runs, in the order it runs, and what it had to leave out.
 *
 * Pure, and it is where the rules that are not preferences live: the bands are ordered by slot
 * whatever the list says, and at most one effect of an EXCLUSIVE slot is honoured. The panel
 * reads `skipped` to say so, rather than leaving a switch that looks on and does nothing.
 */
export function planStack(stack: PostStack): PostPlan {
  const held = PLANS.get(stack)
  if (held) return held

  const made = planned(stack)
  PLANS.set(stack, made)
  return made
}

export type PostPlan = {
  effects: readonly PostEffect[]
  skipped: readonly PostEffect[]
  /** The shape a compiled chain is cached on — see `stackShapeKey`. */
  shapeKey: string
}

/**
 * Held on the stack's IDENTITY, which is what makes it safe: a stack is immutable and replaced by
 * a command, and `postAt` hands back the very same object when nothing drives it. Without this,
 * one composed frame planned three times per surface — fifteen times in a quad layout.
 */
const PLANS = new WeakMap<PostStack, PostPlan>()

function planned(stack: PostStack): PostPlan {
  if (!stack.enabled) return { effects: [], skipped: [], shapeKey: 'off' }

  const live = stack.effects.filter(one => one.enabled)
  const ordered = [...live].sort(
    (left, right) => SLOT_RANK[slotOf(left)] - SLOT_RANK[slotOf(right)],
  )

  const effects: PostEffect[] = []
  const skipped: PostEffect[] = []
  const taken = new Set<PostSlot>()

  for (const one of ordered) {
    const slot = slotOf(one)
    if (EXCLUSIVE.includes(slot)) {
      if (taken.has(slot)) {
        skipped.push(one)
        continue
      }
      taken.add(slot)
    }
    effects.push(one)
  }

  return { effects, skipped, shapeKey: effects.map(one => `${one.id}:${one.effect}`).join('|') }
}

export function slotOf(one: PostEffect): PostSlot {
  return POST_EFFECTS[one.effect].slot
}

/**
 * The shape of a stack, as one string — what a compiled pipeline is cached on.
 *
 * It reads the effects, their order and their switches, and **not one parameter**: moving a
 * slider must reach a uniform, never a rebuild. That single omission is what § 20 asks for.
 */
export function stackShapeKey(stack: PostStack): string {
  return planStack(stack).shapeKey
}

/** Whether a stack would draw anything at all — what tells a caller to take the direct path. */
export function stackDraws(stack: PostStack | null): stack is PostStack {
  return stack !== null && planStack(stack).effects.length > 0
}

/**
 * A parameter, held to what its spec allows. What an import runs every value through, and what a
 * command writes: a number outside its bounds is brought back rather than refused, and a value
 * of the wrong SHAPE falls back on the default.
 */
export function boundParam(spec: PostParamSpec, value: unknown): PostParamValue {
  if (spec.control === 'toggle') return typeof value === 'boolean' ? value : spec.default
  if (spec.control === 'color' || spec.control === 'asset') {
    return typeof value === 'string' ? value : spec.default
  }
  if (spec.control === 'choice') {
    return typeof spec.default === 'string'
      ? oneOf(spec.options, value, spec.default)
      : spec.default
  }
  if (spec.control === 'vector3') return isVector3(value) ? value : spec.default
  if (typeof value !== 'number' || !Number.isFinite(value)) return spec.default
  return bound(value, spec)
}

/**
 * The params of one effect, read back off something that came from disk: every key the effect
 * declares, filled from the payload where it is readable and from the default where it is not.
 *
 * Driven by the SPEC and never by the payload, which is the whole security of § 12: a file
 * naming a parameter no effect declares cannot introduce one.
 */
export function readParams(effect: PostEffectId, payload: unknown): Record<string, PostParamValue> {
  const source = isRecord(payload) ? payload : {}
  return Object.fromEntries(
    Object.entries(POST_EFFECTS[effect].params).map(([key, spec]) => [
      key,
      boundParam(spec, source[key]),
    ]),
  )
}

/**
 * A stack as the studio holds it, from a stack as a file spells it. Effects whose id the studio
 * does not know are DROPPED — see `unknownEffectsIn`, which names them so the import can say so.
 */
export function readStack(payload: unknown, mintId: () => string): PostStack {
  if (!isRecord(payload)) return EMPTY_STACK

  const listed = Array.isArray(payload.effects) ? payload.effects : []
  const effects = listed.flatMap((one: unknown): PostEffect[] => {
    if (!isRecord(one) || !isPostEffectId(one.effect)) return []
    return [
      {
        id: readString(one, 'id', '') || mintId(),
        effect: one.effect,
        enabled: readBoolean(one, 'enabled', true),
        params: readParams(one.effect, one.params),
      },
    ]
  })

  return { enabled: readBoolean(payload, 'enabled', true), effects }
}

/** The effect ids a payload names that this build has no effect for. What an import reports. */
export function unknownEffectsIn(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.effects)) return []

  const named = payload.effects.flatMap((one: unknown) =>
    isRecord(one) && typeof one.effect === 'string' && !isPostEffectId(one.effect)
      ? [one.effect]
      : [],
  )
  return [...new Set(named)]
}

/** A camera's composition as the file spells it. Anything unreadable comes back inheriting. */
export function readCameraPost(payload: unknown, mintId: () => string): CameraPost {
  if (!isRecord(payload)) return INHERIT_POST

  const mode = oneOf(CAMERA_POST_MODES, payload.mode, 'inherit')
  if (mode === 'disabled') return { mode: 'disabled' }
  if (mode === 'override') return { mode: 'override', stack: readStack(payload.stack, mintId) }
  return INHERIT_POST
}

/** Which composition a camera actually films through. `null` is « no post-processing at all ». */
export function postOf(scene: PostStack, camera: CameraPost | undefined): PostStack | null {
  if (!camera || camera.mode === 'inherit') return scene
  if (camera.mode === 'disabled') return null
  return camera.stack
}
