import type { FieldDescriptor, ModelDescriptor, ModelFamily } from './model'
import {
  ADVANCED_GROUP,
  fieldKeysOf,
  fieldsFrom,
  PROMPT_FIELD_KEY,
  type LocalFieldTemplate,
} from './localFields'

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
 * 🛑 Every endpoint, every `model` value and every REQUIRED input below was measured against the
 * live service on 2026-08-31, by posting an incomplete body — refused, so no task was created and
 * nothing was billed. Their reference contradicted itself on all of it: the model page spells
 * `tripo-v3.1`, which the service refuses outright.
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
   * What the run costs with its knobs at their defaults; what a knob adds is on the knob.
   *
   * MEASURED on `text-to-model` alone: 10 credits with `texture:false` and `pbr:false`, which is
   * the documented 20 less the 10 that dropping the texture saves. Every other figure here is
   * still their documentation's.
   */
  readonly credits: number
  readonly fields: readonly LocalFieldTemplate[]
}

/** `tripo:<endpoint>:<model>` — what a job target carries, and what routes its poll. */
const TRIPO_PREFIX = 'tripo:'

export function tripoModelId(entry: TripoEntry): string {
  return `${TRIPO_PREFIX}${entry.endpoint}${entry.model ? `:${entry.model}` : ''}`
}

export function isTripoModelId(modelId: string): boolean {
  return modelId.startsWith(TRIPO_PREFIX)
}

const PROMPT: LocalFieldTemplate = {
  key: PROMPT_FIELD_KEY,
  kind: 'longText',
  labelKey: 'localFields.prompt',
  required: true,
  promptSpark: true,
}

const NEGATIVE_PROMPT: LocalFieldTemplate = {
  key: 'negative_prompt',
  kind: 'longText',
  labelKey: 'localFields.negativePrompt',
  required: false,
  group: ADVANCED_GROUP,
}

/**
 * What an endpoint starts FROM. 🛑 The plan promised one unified `input` everywhere; measured,
 * four endpoints name it otherwise — `file`, `files`, `draft_model_task_id`,
 * `original_model_task_id` — and sending `input` to those is refused with code 1004.
 */
function input(
  kind: 'image' | 'mesh' | 'raw',
  labelKey: string,
  key = 'input',
): LocalFieldTemplate {
  return { key, kind, labelKey, required: true }
}

function seed(key: string, labelKey: string): LocalFieldTemplate {
  return { key, kind: 'seed', labelKey, required: false, group: ADVANCED_GROUP }
}

const TEXTURE: LocalFieldTemplate = {
  key: 'texture',
  kind: 'boolean',
  labelKey: 'tripoFields.texture',
  helpKey: 'tripoFields.textureHelp',
  required: false,
  default: true,
  costImpact: true,
}

/** Documented as overriding `texture` to true, which is why its help says so rather than hiding it. */
const PBR: LocalFieldTemplate = {
  key: 'pbr',
  kind: 'boolean',
  labelKey: 'tripoFields.pbr',
  helpKey: 'tripoFields.pbrHelp',
  required: false,
  default: true,
  costImpact: true,
}

function quality(key: 'texture_quality' | 'geometry_quality'): LocalFieldTemplate {
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

const FACE_LIMIT: LocalFieldTemplate = {
  key: 'face_limit',
  kind: 'integer',
  labelKey: 'tripoFields.face_limit',
  helpKey: 'tripoFields.face_limitHelp',
  required: false,
  min: 100,
  max: 2_000_000,
  group: ADVANCED_GROUP,
}

const QUAD: LocalFieldTemplate = {
  key: 'quad',
  kind: 'boolean',
  labelKey: 'tripoFields.quad',
  helpKey: 'tripoFields.quadHelp',
  required: false,
  default: false,
  group: ADVANCED_GROUP,
  costImpact: true,
}

const SMART_LOW_POLY: LocalFieldTemplate = {
  key: 'smart_low_poly',
  kind: 'boolean',
  labelKey: 'tripoFields.smart_low_poly',
  required: false,
  default: false,
  group: ADVANCED_GROUP,
  costImpact: true,
}

const GENERATE_PARTS: LocalFieldTemplate = {
  key: 'generate_parts',
  kind: 'boolean',
  labelKey: 'tripoFields.generate_parts',
  helpKey: 'tripoFields.generate_partsHelp',
  required: false,
  default: false,
  group: ADVANCED_GROUP,
  costImpact: true,
}

const AUTO_SIZE: LocalFieldTemplate = {
  key: 'auto_size',
  kind: 'boolean',
  labelKey: 'tripoFields.auto_size',
  required: false,
  default: false,
  group: ADVANCED_GROUP,
}

const EXPORT_UV: LocalFieldTemplate = {
  key: 'export_uv',
  kind: 'boolean',
  labelKey: 'tripoFields.export_uv',
  required: false,
  default: true,
  group: ADVANCED_GROUP,
}

const TEXTURE_ALIGNMENT: LocalFieldTemplate = {
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

const AUTOFIX: LocalFieldTemplate = {
  key: 'enable_image_autofix',
  kind: 'boolean',
  labelKey: 'tripoFields.enable_image_autofix',
  helpKey: 'tripoFields.enable_image_autofixHelp',
  required: false,
  default: false,
  group: ADVANCED_GROUP,
}

/** Every knob a mesh generation shares, in the order the form reads them. */
const MESH_KNOBS: readonly LocalFieldTemplate[] = [
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
  { model: 'v3.1-20260211', name: 'Tripo v3.1', lane: 'model-h' },
  { model: 'v3.0-20250812', name: 'Tripo v3.0', lane: 'model-h' },
  { model: 'v2.5-20250123', name: 'Tripo v2.5', lane: 'model-h' },
  { model: 'P1-20260311', name: 'Tripo P1', lane: 'model-p' },
  /**
   * 🛑 Named by the service and by NOTHING else — neither their model page nor the plan this was
   * written from mentions a P2. Its lane is the P one by its name alone, which is the only
   * assumption left in this list.
   */
  { model: 'P2-20260801', name: 'Tripo P2', lane: 'model-p' },
]

/**
 * The picture models, PER ENDPOINT: the service publishes a different list for each, and the
 * plan's `gemini-*` exist nowhere. Measured — `text-to-image` takes `seedream_v4` where
 * `image-to-image` refuses it, and `edit-multiview` takes two names of its own.
 */
const TEXT_TO_IMAGE_MODELS: readonly string[] = [
  'seedream_v4',
  'seedream_v5',
  'banana',
  'banana2',
  'banana_pro',
  'chat_image_1',
  'chat_image_1.5',
  'chat_image_2',
]

const IMAGE_TO_IMAGE_MODELS: readonly string[] = TEXT_TO_IMAGE_MODELS.filter(
  model => model !== 'seedream_v4',
)

const EDIT_MULTIVIEW_MODELS: readonly string[] = ['seedream_v4', 'default']

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
      // `file`, measured: « file is required for image_to_model ».
      fields: [
        input('image', 'tripoFields.sourceImage', 'file'),
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
      // `files`, measured: « files or inputs are required for multiview_to_model ».
      fields: [
        input('raw', 'tripoFields.sourceViews', 'files'),
        AUTOFIX,
        TEXTURE_ALIGNMENT,
        ...MESH_KNOBS,
      ],
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
    // `draft_model_task_id`, measured — and it takes a TASK, never a file.
    fields: [
      input('mesh', 'tripoFields.sourceModel', 'draft_model_task_id'),
      quality('geometry_quality'),
      FACE_LIMIT,
    ],
  },
  {
    endpoint: 'models/stylize',
    name: 'Tripo Stylize',
    family: '3d',
    capability: '3d23d',
    lane: 'post-process',
    credits: 10,
    fields: [
      // `original_model_task_id or file_token`, measured.
      input('mesh', 'tripoFields.sourceModel', 'original_model_task_id'),
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
    // 25, not the 10 their price page quotes — measured on a paid rig, 2026-08-31.
    credits: 25,
    // 🛑 It takes a `model` of ITS OWN — measured: « allowed values: v1.0-20240301, v2.5-20260210 ».
    model: 'v2.5-20260210',
    fields: [
      // Said here rather than nowhere: a rig that does not fit its mesh is only visible once the
      // animation after it has been paid for, and that one costs again.
      { ...input('mesh', 'tripoFields.sourceModel'), helpKey: 'tripoFields.rigSourceHelp' },
      /**
       * 🛑 The skeleton CONVENTION, and the reason a rig came back unusable. Sent nothing, they
       * fall back to their own — bones called `tripo0_Right_Limb_0..9` and seven anonymous
       * `bone_N`, which no retarget of ours can read. `mixamo` names them the standard way.
       */
      {
        key: 'spec',
        kind: 'choice',
        labelKey: 'tripoFields.spec',
        helpKey: 'tripoFields.specHelp',
        required: false,
        default: 'mixamo',
        optionKeys: [
          { value: 'mixamo', labelKey: 'tripoFields.spec_mixamo' },
          { value: 'tripo', labelKey: 'tripoFields.spec_tripo' },
        ],
      },
      /**
       * The topology to rig FOR. `animations/rig-check` answers it for free and this is what it
       * is answered for — a biped walk laid on their default made the character crawl.
       */
      {
        key: 'rig_type',
        kind: 'choice',
        labelKey: 'tripoFields.rig_type',
        helpKey: 'tripoFields.rig_typeHelp',
        required: false,
        default: 'biped',
        optionKeys: [
          'biped',
          'quadruped',
          'avian',
          'aquatic',
          'serpentine',
          'hexapod',
          'octopod',
        ].map(value => ({ value, labelKey: `tripoFields.rig_type_${value}` })),
      },
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

/**
 * What a picture model is CALLED, spelt as the 3D lines are — `Tripo v3.1 · Image`, never a slug.
 *
 * 🛑 The word after the dot carries its weight and cannot be dropped: THREE picture endpoints
 * serve `img2img`, so the model alone would list `Banana Pro` three times in one picker.
 */
function imageModelName(model: string): string {
  const named = IMAGE_MODEL_NAMES[model]
  if (named) return named

  // A model the service adds before this table does: readable, and never a missing entry.
  return model.replace(/[_-]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

/** The word each picture endpoint is known by, in the register the 3D lines already use. */
const ENDPOINT_WORDS: Readonly<Record<string, string>> = {
  'generation/text-to-image': 'Text',
  'generation/image-to-image': 'Image',
  'generation/image-to-multiview': 'Multiview',
  'generation/edit-multiview': 'Multiview edit',
}

/** 🛑 Their own spellings, measured 2026-08-31 — no `gemini-*` among them, whatever the docs say. */
const IMAGE_MODEL_NAMES: Readonly<Record<string, string>> = {
  seedream_v4: 'Seedream v4',
  seedream_v5: 'Seedream v5',
  banana: 'Banana',
  banana2: 'Banana 2',
  banana_pro: 'Banana Pro',
  chat_image_1: 'Chat Image 1',
  'chat_image_1.5': 'Chat Image 1.5',
  chat_image_2: 'Chat Image 2',
}

/**
 * A picture endpoint, once per model the service admits FOR THAT ENDPOINT — measured, the four
 * lists differ, and a cartesian product over one of them offers runs that are refused.
 */
function imageEntries(
  endpoint: string,
  capability: string,
  models: readonly string[],
  fields: readonly LocalFieldTemplate[],
): TripoEntry[] {
  return models.map(model => ({
    endpoint,
    model,
    name: `${imageModelName(model)} · ${ENDPOINT_WORDS[endpoint] ?? endpoint}`,
    family: 'image',
    capability,
    lane: 'image',
    credits: 5,
    fields,
  }))
}

/** Every runnable thing Tripo publishes, endpoint by model. */
export const TRIPO_CATALOGUE: readonly TripoEntry[] = [
  ...LINES.flatMap(meshEntries),
  ...PROCESSING,
  ...imageEntries('generation/text-to-image', 'txt2img', TEXT_TO_IMAGE_MODELS, [
    PROMPT,
    NEGATIVE_PROMPT,
  ]),
  // `prompt` is required « when template is not set », measured — so it stays required here.
  ...imageEntries('generation/image-to-image', 'img2img', IMAGE_TO_IMAGE_MODELS, [
    PROMPT,
    input('image', 'tripoFields.sourceImage'),
    NEGATIVE_PROMPT,
  ]),
  /**
   * 🛑 Its model list is the one thing the service would not name: it validates the input first,
   * so an incomplete body never reaches the model. Left on the text-to-image list, which a real
   * run will confirm or refuse — and a refusal costs nothing.
   */
  ...imageEntries('generation/image-to-multiview', 'img2img', TEXT_TO_IMAGE_MODELS, [
    input('image', 'tripoFields.sourceImage'),
    NEGATIVE_PROMPT,
  ]),
  ...imageEntries('generation/edit-multiview', 'img2img', EDIT_MULTIVIEW_MODELS, [
    PROMPT,
    input('raw', 'tripoFields.sourceViews'),
  ]),
]

const BY_ID = new Map(TRIPO_CATALOGUE.map(entry => [tripoModelId(entry), entry]))

/** The entry a target names, or nothing — a stored id this build no longer publishes is one. */
export function tripoEntryOf(modelId: string): TripoEntry | null {
  return BY_ID.get(modelId) ?? null
}

/** The form, in the reader's language — through the one mapping `localFields.ts` publishes. */
export function tripoFieldsOf(
  entry: TripoEntry,
  translate: (key: string) => string,
): FieldDescriptor[] {
  return fieldsFrom(entry.fields, translate)
}

/**
 * One entry as the model registry publishes it.
 *
 * 🛑 `installed`, `downloadable` and `diskBytes` are LEFT OUT, and `model.ts` says why: they are
 * absent for a model that runs in a cloud, where there is nothing to install. Answered as
 * `false`, every row wore « Pas de moteur » — the badge for weights no engine can open.
 *
 * Here rather than in `services.ts` so the shape is testable: the composition lived inside a
 * module with no test, and nothing said what a Tripo row promises.
 */
export function tripoDescriptorOf(
  entry: TripoEntry,
  translate: (key: string) => string,
): ModelDescriptor {
  return {
    id: tripoModelId(entry),
    name: entry.name,
    family: entry.family,
    runsOn: TRIPO_CLOUD,
    source: TRIPO_CLOUD,
    // Nothing on another company's servers is published by the cloud this studio was built on.
    origin: 'community',
    featured: false,
    capabilities: [entry.capability],
    tags: [],
    thumbnail: '',
    fields: tripoFieldsOf(entry, translate),
  }
}

/** The keys a bundle has to name, read off the catalogue rather than off a copy of it. */
export function tripoFieldKeys(): readonly string[] {
  return fieldKeysOf(TRIPO_CATALOGUE.flatMap(entry => entry.fields))
}
