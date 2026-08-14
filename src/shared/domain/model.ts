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
  /**
   * The file input this one masks, when the model takes an inpainting mask — Scenario calls it
   * "the name of the file input field to use as the mask source". Present only on the mask
   * field itself, which is what lets an edit action fill the pair without naming either.
   */
  maskFrom?: string
  /**
   * Whether this is the field prompt assistance rewrites. The API marks it itself — measured on
   * `model_google-gemini-3-1-flash`, whose `prompt` input carries `promptSpark: true` — so no
   * field name is ever guessed at here.
   */
  promptSpark?: boolean
}

export type ModelFamily =
  | 'image'
  | 'video'
  | '3d'
  | 'audio'
  | 'texture'
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
  'texture',
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

/**
 * The namespace Scenario keeps for its own tags — and the one `GET /models?tags=` does not index.
 *
 * MEASURED 2026-08-14, one request per tag against the real catalogue: `sc:skybox`, `sc:scenario`,
 * `sc:featured`, `sc:texture` and `sc:tool` each answer 0 models, while `image-upscale` answers
 * 13, `remove-background` 9 and `vectorize` 4. The three skybox models carry `sc:skybox` in the
 * records that same endpoint serves when asked for no tag at all, so the tag is real and only the
 * filter is blind to it. Asking for one does not narrow the walk, it ends it — which is what left
 * the skybox workspace with no model to choose from. `POST /search/models` is no way around it
 * either: filtering its hits by the same tag answers nothing too.
 */
export const SYSTEM_TAG_PREFIX = 'sc:'

/**
 * The families no capability can name, and the tag that names each one. Skyboxes were the first;
 * upscaling, cutout and vectorization are the same case — the capability enum holds no value for
 * any of them, and all 29 of those models answer `img2img` like every other image model.
 *
 * Read in both directions, which is why it is a list of pairs: `familyOf` classifies a model by
 * it, and the registry narrows a listing server-side by the ones the API indexes — every family
 * but the skyboxes, whose tag lives in the namespace above. Twenty-six models out of 642 are not
 * worth walking six pages of catalogue to find.
 *
 * A tag alone never decides — see `familyOf`: two of the nine models carrying `remove-background`
 * remove it from video, and they belong to the montage, not to the canvas.
 *
 * A tag listed here belongs to its own family and to no other: offering it in `TAGS_BY_FAMILY`
 * elsewhere would filter a listing down to models that listing has already excluded. Under its
 * own family it is just as useless — every row already carries it.
 *
 * ORDER IS A PRIORITY. A model carrying two of these tags has no right answer — they name
 * different outputs — and the first entry here wins. That is a choice for a stable answer over
 * the order the API happens to serve its tags in.
 */
export type FamilyTag = { family: ModelFamily; tag: string }

export const FAMILY_TAGS: readonly FamilyTag[] = [
  { family: 'skybox', tag: SKYBOX_TAG },
  { family: 'upscale', tag: 'image-upscale' },
  { family: 'background-removal', tag: 'remove-background' },
  { family: 'vectorization', tag: 'vectorize' },
]

/** The tag that stands for a family, when one does. */
export function tagOfFamily(family: ModelFamily): string | undefined {
  return FAMILY_TAGS.find(entry => entry.family === family)?.tag
}

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
  /**
   * The plan grade the API refuses this model below — its `accessRestrictions`. Read against
   * `PlanAccess` by `isBeyondPlan`; absent when the API grades the model with nothing.
   *
   * A plain number, NOT the SDK's `0 | 25 | 50 | 75 | 100` union: two public models answer `1`
   * (Neo3D Realism, Scenario Flux Upscale), which that union does not admit. Measured — the
   * generated type is wrong about its own values, and a closed union would drop the field.
   */
  requiredPlanLevel?: number
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
  texture: ['txt2img_texture', 'img2img_texture', 'controlnet_texture', 'reference_texture'],
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
  // Empty until the same count is run over the family: it was split out of `image` on its
  // capabilities, and borrowing that list would offer tags no texture model may carry.
  texture: [],
  // Left empty on purpose: the family is three models wide — `SKYBOX_TAG` already selected
  // them — and a facet menu narrowing three rows offers a filter whose only answer is fewer.
  skybox: [],
  upscale: [],
  'background-removal': [],
  vectorization: [],
  other: [],
}

/**
 * The i18n key naming each tag on screen, or `null` where the publisher's own word is what it
 * shows — the acronyms, and one product name, which a translation would only obscure.
 *
 * What a tag is CALLED is not what it is MATCHED as: the value above travels to the API exactly
 * as written, and this only names it. That is what lets a French studio read "Depuis un texte"
 * while the request still carries `Text to Image`.
 *
 * One record with a nullable value rather than two lists that answer each other, the shape
 * `NODE_LABEL_KEYS` settled on: two lists can disagree — name a tag and leave it alone at once —
 * and a tag added upstairs then has three places to be entered instead of one.
 *
 * The keys are written here rather than built from the value: `Flux.1 LoRA` holds a dot, and a
 * dot is how i18next spells a level of nesting.
 */
export const TAG_LABEL_KEYS: Record<string, string | null> = {
  'Text to Image': 'modelTags.textToImage',
  'Image to Image': 'modelTags.imageToImage',
  editing: 'modelTags.editing',
  'Post Processing': 'modelTags.postProcessing',
  characters: 'modelTags.characters',
  fantasy: 'modelTags.fantasy',
  cartoon: 'modelTags.cartoon',
  tool: 'modelTags.tool',
  Video: 'modelTags.video',
  'First Frame': 'modelTags.firstFrame',
  'Last Frame': 'modelTags.lastFrame',
  'Video Editing': 'modelTags.videoEditing',
  'Image to 3D': 'modelTags.imageTo3d',
  'Text to 3D': 'modelTags.textTo3d',
  '3D to 3D': 'modelTags.threeDToThreeD',
  Multiview: 'modelTags.multiview',
  Motion: 'modelTags.motion',
  Audio: 'modelTags.audio',
  Music: 'modelTags.music',
  'Text to Music': 'modelTags.textToMusic',
  'Text to Speech': 'modelTags.textToSpeech',
  'Flux.1 LoRA': null,
  T2V: null,
  I2V: null,
  V2V: null,
  PBR: null,
  TTS: null,
}

/** Every key the record names, for the guard that checks the bundles carry them. */
export const TAG_LABEL_KEY_LIST: readonly string[] = Object.values(TAG_LABEL_KEYS).flatMap(
  key => key ?? [],
)

/**
 * A tag's name on screen, given something that translates a key. The value stands in as its own
 * label wherever nobody named it, which is the one wording that is always true — and never a raw
 * key, which reads like a bug.
 */
export function tagLabel(value: string, translate: (key: string) => string): string {
  const key = TAG_LABEL_KEYS[value]
  return key === undefined || key === null ? value : translate(key)
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
  texture: [],
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
