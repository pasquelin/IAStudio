import { describe, expect, it } from 'vitest'
import { translateModelText } from '@shared/i18n'
import { translateSchema, type ScenarioInput } from './schema'

/**
 * What `GET /models/{modelId}` answered on 11/08/2026, copied field for field, for five models
 * covering four families: `model_openai-gpt-image-2`, `model_bytedance-seedance-2-0`,
 * `model_tripo-v3-1-image-to-3d`, `model_elevenlabs-sound-effects-v2` and
 * `model_google-gemini-2-5-flash-tts`.
 *
 * Frozen as INPUT rather than as the labels it produces, and that is the whole point: the form
 * derives a label from a field name (`numOutputs` → `Num outputs`), the dictionary is keyed on
 * that derived label, and a check holding a copy of it would stay green the day the derivation
 * changed its spacing — while every French word quietly fell back to English.
 *
 * A suite that called the API would test the network instead. The date above is what to compare
 * against when this list stops matching what Scenario sends.
 */
const INPUTS: readonly ScenarioInput[] = [
  {
    name: 'prompt',
    type: 'string',
    description: 'Text description of desired generation or edit.',
  },
  { name: 'referenceImages', type: 'array', description: 'Reference images for editing.' },
  { name: 'numOutputs', type: 'number', description: 'Number of images to generate' },
  { name: 'width', type: 'number', description: 'Output width in pixels.' },
  { name: 'height', type: 'number', description: 'Output height in pixels.' },
  {
    name: 'quality',
    type: 'string',
    description: 'Generation quality',
    allowedValues: ['auto', 'high', 'medium', 'low'],
  },
  {
    name: 'background',
    type: 'string',
    description: 'Background option',
    allowedValues: ['auto', 'opaque'],
  },
  // The API sends a label of its own here, which `labelOf` prefers to the derived name.
  {
    name: 'numOutputs',
    label: 'Image Count',
    type: 'number',
    description: 'Number of images to generate',
  },

  {
    name: 'lastFrameImage',
    type: 'file',
    description: 'Last frame image. Only valid when a first frame image is provided.',
  },
  {
    name: 'referenceVideos',
    type: 'array',
    description:
      'Reference videos for multimodal mode (up to 3). Mutually exclusive with first frame.',
  },
  {
    name: 'referenceAudio',
    type: 'array',
    description:
      'Reference audio tracks (up to 3). Requires at least one reference image or video.',
  },
  {
    name: 'resolution',
    type: 'string',
    description: 'Output video resolution',
    allowedValues: ['480p', '720p', '1080p', '4k'],
  },
  {
    name: 'aspectRatio',
    type: 'string',
    description: 'Output aspect ratio',
    allowedValues: ['16:9', '1:1', 'adaptive'],
  },
  {
    name: 'generateAudio',
    type: 'boolean',
    description: 'Whether to generate audio for the video',
  },

  { name: 'image', type: 'file', description: 'Single image for image-to-model.' },
  {
    name: 'texture',
    type: 'boolean',
    description: 'Enable texturing. Set to false for a model without textures.',
  },
  {
    name: 'textureQuality',
    type: 'string',
    description: "Texture quality level. 'Detailed' gives HD quality textures.",
    allowedValues: ['standard', 'detailed', 'extreme'],
  },
  {
    name: 'textureAlignment',
    type: 'string',
    description: 'Determines the prioritization of texture alignment in the 3D model.',
    allowedValues: ['original_image', 'geometry'],
  },
  {
    name: 'geometryQuality',
    type: 'string',
    description: "Geometry quality level. 'Detailed' gives HD quality geometry.",
    allowedValues: ['standard', 'detailed'],
  },
  {
    name: 'textureSeed',
    type: 'number',
    description:
      'Random seed for texture generation. Using the same seed will produce identical textures.',
  },
  {
    name: 'orientation',
    type: 'string',
    description:
      "Set orientation to 'Align Image' will automatically rotate the model to align the original image.",
    allowedValues: ['default', 'align_image'],
  },
  {
    name: 'pbr',
    type: 'boolean',
    description:
      'Enable PBR generation. Default value is True. If this option is set to True, texture parameters will be ignored.',
  },
  {
    name: 'faceLimit',
    type: 'number',
    description:
      'Maximum face count. Adaptive if unset. With Smart Low Poly: 1,000-20,000 (500-10,000 if Quad is also enabled). Otherwise capped at 1,500,000 (standard geometry) or 2,000,000 (detailed geometry). Quad alone caps face limit at 150,000.',
  },
  {
    name: 'autoSize',
    type: 'boolean',
    description: 'Automatically scale the model to real-world dimensions, with the unit in meters.',
  },
  {
    name: 'quad',
    type: 'boolean',
    description:
      'Enable quad mesh output (FBX format). When Smart Low Poly is off, face limit is capped at 150,000. When Smart Low Poly is on and Face Limit is unset, defaults to 10,000.',
  },
  {
    name: 'smartLowPoly',
    type: 'boolean',
    description:
      'Generate hand-crafted low-poly topology. When enabled and Face Limit is set: 1,000-20,000 (500-10,000 if Quad is also enabled).',
  },
  {
    name: 'generateParts',
    type: 'boolean',
    description: 'Generate segmented 3D model parts. Incompatible with texture, pbr, and quad.',
  },
  {
    name: 'seed',
    type: 'number',
    description:
      'Random seed for model generation. The seed controls the geometry generation process, ensuring identical models when the same seed is used.',
  },

  {
    name: 'text',
    type: 'string',
    description: 'A textual description of the sound effect to generate.',
  },
  {
    name: 'durationSeconds',
    type: 'number',
    description:
      'Duration in seconds (0.5-30). If not set, optimal duration will be determined from prompt.',
  },
  {
    name: 'promptInfluence',
    type: 'number',
    description: 'How closely to follow the sound description. Higher values mean less variation.',
  },
  { name: 'loop', type: 'boolean', description: 'Whether to loop the sound effect.' },
  { name: 'outputFormat', type: 'string', description: 'Output audio format.' },
  { name: 'voice', type: 'string', description: 'Voice preset to use for speech synthesis.' },
  {
    name: 'language',
    type: 'string',
    description: 'Language for speech synthesis (auto-detected if not specified).',
  },
]

/**
 * The four labels this list produces that French writes exactly as English does. They cannot be
 * dictionary keys at all — a value normalizing back to its own key fails the guard beside the
 * bundle — so an untranslated one is the right answer here, not a gap. `Prompt` is a fifth kind
 * of case: `KEPT_IN_ENGLISH` decided it belongs to the vocabulary of the craft.
 *
 * Named one by one rather than by a shape. "Any single word" was the first try, and it swallowed
 * the very defect this file exists to catch: with the derivation broken, `numOutputs` becomes
 * `Numoutputs`, a single word, exempt — and every label falls back to English with the suite
 * still green. A cognate is a fact about a word, not about its length.
 */
const SAME_IN_BOTH = ['Prompt', 'Image', 'Texture', 'Orientation']

const FIELDS = translateSchema(INPUTS)

describe('every word the generation form derives from a model schema', () => {
  it('is said in French, or is one of the four words French writes the same way', () => {
    const untranslated = FIELDS.map(field => field.label)
      .filter(label => translateModelText(label, 'fr') === label)
      .filter(label => !SAME_IN_BOTH.includes(label))

    expect(untranslated).toEqual([])
  })

  // The exemption answers about THIS list, so it cannot outlive it: a word nobody derives any
  // more is a licence left lying around, and the next label to land on it would go unread.
  it('exempts no word the schema does not produce', () => {
    const labels = FIELDS.map(field => field.label)

    expect(SAME_IN_BOTH.filter(word => !labels.includes(word))).toEqual([])
  })

  it('is said in French for what the field explains, too', () => {
    const untranslated = FIELDS.flatMap(field => field.help ?? []).filter(
      help => translateModelText(help, 'fr') === help,
    )

    expect(untranslated).toEqual([])
  })

  /**
   * Codes stay codes: `480p` and `16:9` read the same in every language, and `auto` is a cognate.
   * What must not survive is a token still wearing the underscore it was written with.
   */
  it('offers no choice still spelled as an API token', () => {
    const raw = FIELDS.flatMap(field => field.options ?? []).filter(option =>
      /[_-]/.test(option.label),
    )

    expect(raw).toEqual([])
  })

  it('sends the value the API matches, whatever the choice is called', () => {
    const alignment = FIELDS.find(field => field.key === 'textureAlignment')

    expect(alignment?.options).toContainEqual({ value: 'original_image', label: 'Original image' })
  })
})
