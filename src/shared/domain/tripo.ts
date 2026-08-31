import type { FieldDescriptor, ModelFamily } from './model'
import { ADVANCED_GROUP, PROMPT_FIELD_KEY, type LocalFieldTemplate } from './localFields'

/**
 * The Tripo catalogue, as DATA — their API publishes no model listing, so the studio carries one.
 *
 * Same shape as `localFields.ts`, and for the same reason: a form written per entry would be the
 * hand-written form invariant 5 forbids. What differs is that a Tripo entry is an ENDPOINT × a
 * model, because their v3 gives one endpoint per capability rather than one model id per run.
 */

/** The cloud id. Written once, read by the runner, the registry and the picker alike. */
export const TRIPO_CLOUD = 'tripo'

/** `https://openapi.tripo3d.ai/v3` — measured 2026-08-31: a bare GET answers 401 code 2. */
export const TRIPO_BASE_URL = 'https://openapi.tripo3d.ai/v3'

/**
 * The buckets Tripo counts concurrent tasks in. Not a studio invention: exceeding one answers
 * HTTP 429 code 2000, so the studio holds its own counters rather than discovering a refusal.
 */
export type TripoLane = 'model-h' | 'model-p' | 'image' | 'animation' | 'post-process' | 'mesh'

/** Their published ceilings. `image` at ONE is what makes a lane per category necessary at all. */
export const TRIPO_LANE_LIMITS: Record<TripoLane, number> = {
  'model-h': 10,
  'model-p': 5,
  image: 1,
  animation: 10,
  'post-process': 5,
  mesh: 10,
}

/**
 * One runnable thing: an endpoint, and the model it is asked for when it takes one.
 *
 * `credits` is what the run costs before any knob is turned — a figure the studio quotes and
 * never bills. What a knob adds is on the knob itself, as `costImpact`.
 */
export type TripoEntry = {
  /** Path under `TRIPO_BASE_URL`, with no leading slash. */
  readonly endpoint: string
  /** The `model` parameter, for the endpoints that take one. */
  readonly model?: string
  readonly name: string
  readonly family: ModelFamily
  /** A capability of `CAPABILITIES_BY_FAMILY` — what employment the picker offers it under. */
  readonly capability: string
  readonly lane: TripoLane
  /**
   * 🛑 NOT MEASURED. Read off their documentation, never off a run — no generation has been
   * launched. The one figure a real submission will correct, and it is quoted as an estimate.
   */
  readonly credits: number
  readonly fields: readonly TripoFieldTemplate[]
}

/**
 * One knob, before a language is chosen — `LocalFieldTemplate` with its closed lists named by
 * key too. A `FieldOption.label` is SCREEN TEXT, so a catalogue that filled it directly would be
 * writing French into `shared/`; `optionKeys` is the half that survives translation.
 */
export type TripoFieldTemplate = Omit<LocalFieldTemplate, 'options'> & {
  readonly optionKeys?: readonly { readonly value: string; readonly labelKey: string }[]
}

/** `tripo:<endpoint>:<model>` — what a job target carries, and what routes its poll. */
const TRIPO_PREFIX = 'tripo:'

export function tripoModelId(entry: TripoEntry): string {
  return `${TRIPO_PREFIX}${entry.endpoint}${entry.model ? `:${entry.model}` : ''}`
}

export function isTripoModelId(modelId: string): boolean {
  return modelId.startsWith(TRIPO_PREFIX)
}

const PROMPT: TripoFieldTemplate = {
  key: PROMPT_FIELD_KEY,
  kind: 'longText',
  labelKey: 'localFields.prompt',
  required: true,
  promptSpark: true,
}

const NEGATIVE_PROMPT: TripoFieldTemplate = {
  key: 'negative_prompt',
  kind: 'longText',
  labelKey: 'localFields.negativePrompt',
  required: false,
  group: ADVANCED_GROUP,
}

/**
 * The one input field of every endpoint that starts from something already made — a picture, or
 * a model a previous run produced. Their v3 unified five v2 field names into this one, which
 * takes a `task_id`, a URL or a `file_token` indifferently.
 */
function input(kind: 'image' | 'mesh' | 'raw', labelKey: string): TripoFieldTemplate {
  return { key: 'input', kind, labelKey, required: true }
}

function seed(key: string, labelKey: string): TripoFieldTemplate {
  return { key, kind: 'seed', labelKey, required: false, group: ADVANCED_GROUP }
}

const TEXTURE: TripoFieldTemplate = {
  key: 'texture',
  kind: 'boolean',
  labelKey: 'tripoFields.texture',
  helpKey: 'tripoFields.textureHelp',
  required: false,
  default: true,
  costImpact: true,
}

/** Documented as overriding `texture` to true, which is why its help says so rather than hiding it. */
const PBR: TripoFieldTemplate = {
  key: 'pbr',
  kind: 'boolean',
  labelKey: 'tripoFields.pbr',
  helpKey: 'tripoFields.pbrHelp',
  required: false,
  default: true,
  costImpact: true,
}

function quality(key: 'texture_quality' | 'geometry_quality'): TripoFieldTemplate {
  return {
    key,
    kind: 'choice',
    labelKey: `tripoFields.${key}`,
    required: false,
    default: 'standard',
    optionKeys: [
      { value: 'standard', labelKey: 'tripoFields.qualityStandard' },
      { value: 'detailed', labelKey: 'tripoFields.qualityDetailed' },
    ],
    group: ADVANCED_GROUP,
    costImpact: true,
  }
}

const FACE_LIMIT: TripoFieldTemplate = {
  key: 'face_limit',
  kind: 'integer',
  labelKey: 'tripoFields.face_limit',
  helpKey: 'tripoFields.face_limitHelp',
  required: false,
  min: 100,
  max: 2_000_000,
  group: ADVANCED_GROUP,
}

const QUAD: TripoFieldTemplate = {
  key: 'quad',
  kind: 'boolean',
  labelKey: 'tripoFields.quad',
  helpKey: 'tripoFields.quadHelp',
  required: false,
  default: false,
  group: ADVANCED_GROUP,
  costImpact: true,
}

const SMART_LOW_POLY: TripoFieldTemplate = {
  key: 'smart_low_poly',
  kind: 'boolean',
  labelKey: 'tripoFields.smart_low_poly',
  required: false,
  default: false,
  group: ADVANCED_GROUP,
  costImpact: true,
}

const GENERATE_PARTS: TripoFieldTemplate = {
  key: 'generate_parts',
  kind: 'boolean',
  labelKey: 'tripoFields.generate_parts',
  helpKey: 'tripoFields.generate_partsHelp',
  required: false,
  default: false,
  group: ADVANCED_GROUP,
  costImpact: true,
}

const AUTO_SIZE: TripoFieldTemplate = {
  key: 'auto_size',
  kind: 'boolean',
  labelKey: 'tripoFields.auto_size',
  required: false,
  default: false,
  group: ADVANCED_GROUP,
}

const EXPORT_UV: TripoFieldTemplate = {
  key: 'export_uv',
  kind: 'boolean',
  labelKey: 'tripoFields.export_uv',
  required: false,
  default: true,
  group: ADVANCED_GROUP,
}

const TEXTURE_ALIGNMENT: TripoFieldTemplate = {
  key: 'texture_alignment',
  kind: 'choice',
  labelKey: 'tripoFields.texture_alignment',
  required: false,
  default: 'original_image',
  optionKeys: [
    { value: 'original_image', labelKey: 'tripoFields.alignmentImage' },
    { value: 'geometry', labelKey: 'tripoFields.alignmentGeometry' },
  ],
  group: ADVANCED_GROUP,
}

const AUTOFIX: TripoFieldTemplate = {
  key: 'enable_image_autofix',
  kind: 'boolean',
  labelKey: 'tripoFields.enable_image_autofix',
  helpKey: 'tripoFields.enable_image_autofixHelp',
  required: false,
  default: false,
  group: ADVANCED_GROUP,
}

/** Every knob a mesh generation shares, in the order the form reads them. */
const MESH_KNOBS: readonly TripoFieldTemplate[] = [
  TEXTURE,
  PBR,
  quality('texture_quality'),
  quality('geometry_quality'),
  FACE_LIMIT,
  QUAD,
  SMART_LOW_POLY,
  GENERATE_PARTS,
  AUTO_SIZE,
  EXPORT_UV,
  seed('model_seed', 'tripoFields.model_seed'),
  seed('texture_seed', 'tripoFields.texture_seed'),
]

/**
 * The 3D lines their v3 serves — FOUR, not the five their model page lists: Turbo and v1.4 did
 * not follow the migration. `lane` is what tells a P line from an H one, which is also the two
 * concurrency buckets they are counted in.
 */
type TripoLine = { readonly model: string; readonly name: string; readonly lane: TripoLane }

const LINES: readonly TripoLine[] = [
  { model: 'tripo-v3.1', name: 'Tripo v3.1', lane: 'model-h' },
  { model: 'tripo-p1', name: 'Tripo P1', lane: 'model-p' },
  { model: 'tripo-v3.0', name: 'Tripo v3.0', lane: 'model-h' },
  { model: 'tripo-v2.5', name: 'Tripo v2.5', lane: 'model-h' },
]

/**
 * The image models their v3 offers, every one of them a third party's. No line of ours: a name
 * the picker shows is the name the service publishes.
 */
const IMAGE_MODELS: readonly string[] = [
  'seedream_v4',
  'seedream_v5',
  'gemini-2.5-flash',
  'gemini-3-pro',
  'gemini-3.1-flash',
  'chat_image_1',
  'chat_image_1.5',
  'chat_image_2',
]

/** What one line offers, across the three endpoints that start a model from scratch. */
function meshEntries(line: TripoLine): TripoEntry[] {
  const common: Pick<TripoEntry, 'family' | 'model' | 'lane' | 'credits'> = {
    family: '3d',
    model: line.model,
    lane: line.lane,
    credits: 20,
  }

  return [
    {
      ...common,
      endpoint: 'generation/text-to-model',
      name: `${line.name} · Text`,
      capability: 'txt23d',
      fields: [PROMPT, NEGATIVE_PROMPT, ...MESH_KNOBS],
    },
    {
      ...common,
      endpoint: 'generation/image-to-model',
      name: `${line.name} · Image`,
      capability: 'img23d',
      fields: [
        input('image', 'tripoFields.sourceImage'),
        AUTOFIX,
        TEXTURE_ALIGNMENT,
        ...MESH_KNOBS,
      ],
    },
    {
      ...common,
      endpoint: 'generation/multiview-to-model',
      name: `${line.name} · Multiview`,
      capability: 'img23d',
      fields: [input('raw', 'tripoFields.sourceViews'), AUTOFIX, TEXTURE_ALIGNMENT, ...MESH_KNOBS],
    },
  ]
}

/**
 * What is done TO a model that already exists — their post-process and mesh endpoints, plus the
 * two that rig and the one that retargets. None takes a `model`: the line is the one that made
 * the input, which travels as a task id.
 */
const PROCESSING: readonly TripoEntry[] = [
  {
    endpoint: 'models/texture',
    name: 'Tripo Texture',
    family: '3d',
    capability: '3d23d',
    lane: 'post-process',
    credits: 20,
    fields: [
      input('mesh', 'tripoFields.sourceModel'),
      { ...PROMPT, key: 'texture_prompt', required: false, labelKey: 'tripoFields.texture_prompt' },
      TEXTURE,
      PBR,
      quality('texture_quality'),
      TEXTURE_ALIGNMENT,
      seed('texture_seed', 'tripoFields.texture_seed'),
    ],
  },
  {
    endpoint: 'models/refine',
    name: 'Tripo Refine',
    family: '3d',
    capability: '3d23d',
    lane: 'post-process',
    credits: 20,
    fields: [input('mesh', 'tripoFields.sourceModel'), quality('geometry_quality'), FACE_LIMIT],
  },
  {
    endpoint: 'models/stylize',
    name: 'Tripo Stylize',
    family: '3d',
    capability: '3d23d',
    lane: 'post-process',
    credits: 10,
    fields: [
      input('mesh', 'tripoFields.sourceModel'),
      {
        key: 'style',
        kind: 'text',
        labelKey: 'tripoFields.style',
        helpKey: 'tripoFields.styleHelp',
        required: true,
      },
    ],
  },
  {
    endpoint: 'models/convert',
    name: 'Tripo Convert',
    family: '3d',
    capability: '3d23d',
    lane: 'post-process',
    credits: 10,
    fields: [
      input('mesh', 'tripoFields.sourceModel'),
      {
        key: 'format',
        kind: 'choice',
        labelKey: 'tripoFields.format',
        required: true,
        default: 'GLTF',
        optionKeys: ['GLTF', 'USDZ', 'FBX', 'OBJ', 'STL', '3MF'].map(value => ({
          value,
          labelKey: `tripoFields.format_${value}`,
        })),
      },
      QUAD,
      FACE_LIMIT,
    ],
  },
  {
    endpoint: 'mesh/segment',
    name: 'Tripo Segment',
    family: '3d',
    capability: '3d23d',
    lane: 'mesh',
    credits: 10,
    fields: [input('mesh', 'tripoFields.sourceModel')],
  },
  {
    endpoint: 'mesh/complete',
    name: 'Tripo Complete',
    family: '3d',
    capability: '3d23d',
    lane: 'mesh',
    credits: 10,
    fields: [input('mesh', 'tripoFields.sourceModel')],
  },
  {
    endpoint: 'mesh/decimate',
    name: 'Tripo Decimate',
    family: '3d',
    capability: '3d23d',
    lane: 'mesh',
    credits: 10,
    fields: [input('mesh', 'tripoFields.sourceModel'), FACE_LIMIT, QUAD],
  },
  {
    endpoint: 'animations/rig',
    name: 'Tripo Rig',
    family: '3d',
    capability: 'rig',
    lane: 'animation',
    credits: 10,
    fields: [
      input('mesh', 'tripoFields.sourceModel'),
      {
        key: 'out_format',
        kind: 'choice',
        labelKey: 'tripoFields.out_format',
        required: false,
        default: 'glb',
        optionKeys: [
          { value: 'glb', labelKey: 'tripoFields.format_GLTF' },
          { value: 'fbx', labelKey: 'tripoFields.format_FBX' },
        ],
        group: ADVANCED_GROUP,
      },
    ],
  },
  {
    endpoint: 'animations/rig-check',
    name: 'Tripo Rig check',
    family: '3d',
    capability: 'rig',
    lane: 'animation',
    credits: 0,
    fields: [input('mesh', 'tripoFields.sourceModel')],
  },
  {
    endpoint: 'animations/retarget',
    name: 'Tripo Retarget',
    family: '3d',
    capability: 'motion',
    lane: 'animation',
    credits: 10,
    fields: [
      input('mesh', 'tripoFields.sourceRig'),
      {
        key: 'animation',
        kind: 'text',
        labelKey: 'tripoFields.animation',
        helpKey: 'tripoFields.animationHelp',
        required: true,
      },
    ],
  },
]

/** What one image model offers, across the four endpoints their v3 serves pictures with. */
function imageEntries(model: string): TripoEntry[] {
  const common: Pick<TripoEntry, 'family' | 'model' | 'lane' | 'credits'> = {
    family: 'image',
    model,
    lane: 'image',
    credits: 5,
  }

  return [
    {
      ...common,
      endpoint: 'generation/text-to-image',
      name: `${model} · Text`,
      capability: 'txt2img',
      fields: [PROMPT, NEGATIVE_PROMPT],
    },
    {
      ...common,
      endpoint: 'generation/image-to-image',
      name: `${model} · Image`,
      capability: 'img2img',
      fields: [PROMPT, input('image', 'tripoFields.sourceImage'), NEGATIVE_PROMPT],
    },
    {
      ...common,
      endpoint: 'generation/image-to-multiview',
      name: `${model} · Multiview`,
      capability: 'img2img',
      fields: [input('image', 'tripoFields.sourceImage'), NEGATIVE_PROMPT],
    },
    {
      ...common,
      endpoint: 'generation/edit-multiview',
      name: `${model} · Edit multiview`,
      capability: 'img2img',
      fields: [PROMPT, input('raw', 'tripoFields.sourceViews')],
    },
  ]
}

/** Every runnable thing Tripo publishes, endpoint by model. */
export const TRIPO_CATALOGUE: readonly TripoEntry[] = [
  ...LINES.flatMap(meshEntries),
  ...PROCESSING,
  ...IMAGE_MODELS.flatMap(imageEntries),
]

const BY_ID = new Map(TRIPO_CATALOGUE.map(entry => [tripoModelId(entry), entry]))

/** The entry a target names, or nothing — a stored id this build no longer publishes is one. */
export function tripoEntryOf(modelId: string): TripoEntry | null {
  return BY_ID.get(modelId) ?? null
}

/**
 * The form, in the reader's language. `translate` is handed in for the reason `localFieldsOf`
 * takes one: this runs in the main process, where the language is a service.
 */
export function tripoFieldsOf(
  entry: TripoEntry,
  translate: (key: string) => string,
): FieldDescriptor[] {
  return entry.fields.map(({ labelKey, helpKey, optionKeys, ...field }) => ({
    ...field,
    label: translate(labelKey),
    ...(helpKey ? { help: translate(helpKey) } : {}),
    ...(optionKeys
      ? { options: optionKeys.map(one => ({ value: one.value, label: translate(one.labelKey) })) }
      : {}),
  }))
}

/** The keys a bundle has to name, read off the catalogue rather than off a copy of it. */
export function tripoFieldKeys(): readonly string[] {
  return TRIPO_CATALOGUE.flatMap(entry =>
    entry.fields.flatMap(field => [
      field.labelKey,
      ...(field.helpKey ? [field.helpKey] : []),
      ...(field.optionKeys ?? []).map(one => one.labelKey),
    ]),
  )
}
