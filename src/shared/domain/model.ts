/**
 * A Scenario model's inputs are specific to each model and are discovered at runtime
 * (`GET /models/{id}`). `FieldDescriptor` is their normalized shape, the only one the
 * renderer ever sees — see spec § 6.
 */
export type FieldKind =
  | 'text'
  | 'longText'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'choice'
  | 'image'
  | 'color'
  | 'seed'
  | 'raw'

export type FieldOption = {
  value: string
  label: string
}

export type FieldDescriptor = {
  key: string
  kind: FieldKind
  label: string
  help?: string
  required: boolean
  default?: unknown
  min?: number
  max?: number
  step?: number
  options?: FieldOption[]
  group?: string
  dependsOn?: { key: string; value: unknown }
}

export type ModelFamily =
  | 'image'
  | 'video'
  | '3d'
  | 'audio'
  | 'skybox'
  | 'upscale'
  | 'background-removal'
  | 'vectorization'
  | 'other'

export const MODEL_FAMILIES: readonly ModelFamily[] = [
  'image',
  'video',
  '3d',
  'audio',
  'skybox',
  'upscale',
  'background-removal',
  'vectorization',
  'other',
]

/**
 * Who published the model. The API exposes no author name — only an opaque `authorId` — so
 * the `sc:scenario` tag is the single authorship signal there is to filter on.
 */
export type ModelOrigin = 'official' | 'community'

export const MODEL_ORIGINS: readonly ModelOrigin[] = ['official', 'community']

/**
 * How many model ids one preview request may carry — the batch becomes a single request body
 * downstream. Shared, because the IPC channel refuses more and a refused batch would be lost
 * without a word.
 */
export const MODEL_IDS_BATCH_LIMIT = 100

export const OFFICIAL_TAG = 'sc:scenario'

/** Scenario's own highlight, and the badge their grid shows: 23 of the 642 public models. */
export const FEATURED_TAG = 'sc:featured'

/**
 * What marks a model as producing 360 panoramas. The ONLY signal there is: the capability enum
 * holds no skybox value — measured against `models.list`'s own enum — and these models answer
 * `txt2img`/`img2img` like any image model. Skyboxes are a `jobType` of the generation API, not
 * a category of the catalogue, so without this tag the workspace could not tell them apart.
 */
export const SKYBOX_TAG = 'sc:skybox'

export type ModelSummary = {
  id: string
  name: string
  family: ModelFamily
  /**
   * Where the model comes from — `scenario`, `civitai`, `huggingface`, … Left a plain string
   * rather than a union: the API adds values without warning, and an unknown origin must not
   * make a model disappear from the picker.
   */
  source: string
  origin: ModelOrigin
  featured: boolean
  capabilities: readonly string[]
  tags: readonly string[]
  description?: string
  thumbnail?: string
  /**
   * An example picture published by the model's owner, to stand in when `thumbnail` is unset —
   * which it is on 482 of the 642 public models. Its URL is signed and short-lived, so it is
   * resolved when the card is actually seen, never here.
   */
  previewAssetId?: string
  createdAt?: string
}

export type ModelDescriptor = ModelSummary & {
  fields: FieldDescriptor[]
}

/**
 * `relevance` maps to the API's own `score`, which it documents as blending usage and
 * popularity, and which `GET /models?privacy=public` already sorts by when asked for nothing
 * else. There is no rating and no duration to sort on: both come back empty on every model.
 */
export type ModelSort = 'relevance' | 'recent' | 'oldest'

export const MODEL_SORTS: readonly ModelSort[] = ['relevance', 'recent', 'oldest']

/**
 * Capabilities worth offering as a filter, per family — taken from the API's own enum. Only a
 * head of it: `controlnet_inpaint_ip_adapter` and its kin are combinations a user filters by
 * their parts, not by name.
 */
export const CAPABILITIES_BY_FAMILY: Record<ModelFamily, readonly string[]> = {
  image: ['txt2img', 'img2img', 'inpaint', 'outpaint', 'controlnet', 'reference'],
  video: ['txt2video', 'img2video', 'video2video'],
  '3d': ['txt23d', 'img23d', '3d23d'],
  audio: ['txt2audio', 'audio2audio', 'video2audio'],
  // Empty like its tags and its publishers below, and for the same reason: the family is three
  // models wide, and a two-option menu narrowing three rows only ever answers "fewer".
  skybox: [],
  upscale: [],
  'background-removal': [],
  vectorization: [],
  other: [],
}

/**
 * Tags worth offering per family, taken from a count over the 642 public models rather than
 * invented. They cannot be read off the API: `GET /tags` answers with the caller's OWN tags —
 * measured: zero on a fresh account — and deriving them from the loaded page would make the
 * menu change while scrolling. Case matters: the API matches tags exactly.
 */
export const TAGS_BY_FAMILY: Record<ModelFamily, readonly string[]> = {
  image: [
    'Flux.1 LoRA',
    'Text to Image',
    'Image to Image',
    'editing',
    'Post Processing',
    'image-upscale',
    'characters',
    'fantasy',
    'cartoon',
    'tool',
  ],
  video: [
    'Video',
    'T2V',
    'I2V',
    'V2V',
    'First Frame',
    'Last Frame',
    'Video Editing',
    'Post Processing',
  ],
  '3d': ['Image to 3D', 'Text to 3D', '3D to 3D', 'PBR', 'Multiview', 'Motion'],
  audio: ['Audio', 'TTS', 'Music', 'Text to Music', 'Text to Speech'],
  // Left empty on purpose: the family is three models wide — `SKYBOX_TAG` already selected
  // them — and a facet menu narrowing three rows offers a filter whose only answer is fewer.
  skybox: [],
  upscale: [],
  'background-removal': [],
  vectorization: [],
  other: [],
}

/**
 * Who built the model, as a tag. NOT `authorId`: every public model carries the same opaque
 * one — Scenario's — and no endpoint resolves it to a name, so their own "Author" menu cannot
 * be reading it either. The publisher lives in the tags; filtering by one is an ordinary tag
 * filter, applied by the API.
 *
 * Split per family, and counted there: Kling and Vidu publish video, Tripo and Meshy publish
 * 3D. One flat list would offer, in the Image workspace, publishers that cannot match a single
 * image model — a menu entry whose only possible answer is "no result".
 */
export const PUBLISHERS_BY_FAMILY: Record<ModelFamily, readonly string[]> = {
  image: ['Deacon', 'Black Forest Labs', 'Recraft', 'Ideogram', 'Google', 'Qwen', 'Alibaba'],
  video: ['Kling', 'Vidu', 'Alibaba', 'Wan', 'Bytedance', 'Luma', 'Google', 'Grok'],
  '3d': ['Tripo', 'Tencent', 'Meshy', 'Hunyuan', 'Rodin'],
  audio: ['ElevenLabs', 'Google', 'Bytedance'],
  // Empty for the same reason as its tags: Scenario, BFL and Tencent publish one model each.
  skybox: [],
  upscale: [],
  'background-removal': [],
  vectorization: [],
  other: [],
}

/**
 * How far back a listing reaches. A span rather than a date: the renderer would otherwise
 * rebuild an ISO string on every render, and every one of them would be a new cache key.
 */
export type ModelPeriod = 'day' | 'week' | 'month' | 'quarter'

export const MODEL_PERIODS: readonly ModelPeriod[] = ['day', 'week', 'month', 'quarter']

/** Days each span covers, applied by the main process against its own clock. */
export const PERIOD_DAYS: Record<ModelPeriod, number> = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 90,
}

export type ModelQuery = {
  family?: ModelFamily
  search?: string
  origin?: ModelOrigin
  capabilities?: readonly string[]
  /** Matched by the API, which narrows to models carrying them. */
  tags?: readonly string[]
  /**
   * Keeps only models created within the span. Forces the date order: the API refuses
   * `createdAfter` under any other, and says so with a 400.
   */
  since?: ModelPeriod
  sort?: ModelSort
  /** Opaque continuation handed back by the previous page; absent asks for the first one. */
  cursor?: string
  limit?: number
}

export type ModelPage = {
  items: ModelSummary[]
  /** `null` once the catalogue is exhausted, which is how the list knows to stop asking. */
  cursor: string | null
}
