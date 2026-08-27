import { defaultAssetFolder, type Asset, type AssetType } from '@shared/domain/asset'
import { assetFileName, generatedAssetName } from '@shared/domain/assetName'
import { pathIn } from '@shared/domain/folder'
import type { Job } from '@shared/domain/job'
import type { PbrChannel } from '@shared/domain/material'
import {
  CAPABILITIES_BY_FAMILY,
  type FieldDescriptor,
  type ModelDescriptor,
  type ModelFamily,
  type ModelPage,
  type ModelQuery,
  type ModelSummary,
} from '@shared/domain/model'
import type { MemoryCatalog } from './memoryCatalog'
import { WHEN } from './project'
import type { MemoryFolder } from './memoryFolder'

/**
 * The NETWORK, and nothing else. 🛑 The studio places a picture by a field's `kind`, never by its
 * key, so the keys below are arbitrary and the kinds are the contract — written from the app's
 * own types, no `scenario` MCP server being reachable to check a real schema against.
 */
export type MemoryCloud = {
  searchModels: (query?: ModelQuery) => Promise<ModelPage>
  describeModel: (modelId: string) => Promise<ModelDescriptor>
  generate: (modelId: string, body: Record<string, unknown>) => Promise<Job>
  /** What family a job ran, which `Job` does not carry — an oracle asks it by `targetId`. */
  familyOf: (modelId: string) => ModelFamily | null
  /** The schema, read the way a mounted panel already holds it rather than fetched again. */
  fieldsOf: (modelId: string) => FieldDescriptor[]
}

/** What each family's output is filed as, and the suffix its file carries. */
/**
 * `map` on the material line and nowhere else: a whole surface IS the base colour, which is what
 * `channelFromProviderType` answers for the API's own `texture` — and it is the only thing that
 * files the picture with the materials rather than with the photographs.
 */
const OUTPUT: Partial<
  Record<ModelFamily, { type: AssetType; extension: string; map?: PbrChannel }>
> = {
  image: { type: 'image', extension: 'png' },
  video: { type: 'video', extension: 'mp4' },
  '3d': { type: 'mesh', extension: 'glb' },
  audio: { type: 'audio', extension: 'wav' },
  material: { type: 'image', extension: 'png', map: 'baseColor' },
  skybox: { type: 'skybox', extension: 'png' },
}

const PROMPT: FieldDescriptor = {
  key: 'prompt',
  kind: 'longText',
  label: 'Prompt',
  required: true,
  promptSpark: true,
}

/**
 * A picture the run works FROM. Its key is not what places it — `fillSourceFields` matches on
 * `kind` — so « utilise cette image comme référence » turns on this line existing, not on a name.
 */
const REFERENCE: FieldDescriptor = {
  key: 'image',
  kind: 'image',
  label: 'Reference image',
  required: false,
}

/** The families the batterie generates in — one demo model each. */
const FAMILIES: readonly ModelFamily[] = ['image', 'video', '3d', 'audio', 'material', 'skybox']

const MODELS: readonly (ModelSummary & { fields: FieldDescriptor[] })[] = FAMILIES.map(family => ({
  id: `model-${family}`,
  name: `Demo ${family}`,
  family,
  runsOn: 'scenario',
  source: 'scenario',
  origin: 'official',
  featured: true,
  capabilities: CAPABILITIES_BY_FAMILY[family],
  tags: [],
  createdAt: WHEN,
  fields: family === 'audio' ? [PROMPT] : [PROMPT, REFERENCE],
}))

const found = (modelId: string) => MODELS.find(one => one.id === modelId)

/** What the studio calls a generation — its prompt, cut and folded by the app's own rule. */
const nameOfRun = (label: string, body: Record<string, unknown>): string =>
  generatedAssetName({
    ...(typeof body['prompt'] === 'string' ? { prompt: body['prompt'] } : {}),
    label,
    index: 0,
    total: 1,
  })

export function createMemoryCloud(folder: MemoryFolder, catalog: MemoryCatalog): MemoryCloud {
  let runs = 0

  return {
    searchModels: (query = {}) =>
      Promise.resolve({
        items: MODELS.filter(
          one =>
            (query.family === undefined || one.family === query.family) &&
            (!query.search || one.name.toLowerCase().includes(query.search.toLowerCase())),
        ).map(({ fields: _fields, ...summary }) => summary),
        cursor: null,
      }),

    describeModel: modelId => {
      const model = found(modelId)
      return model ? Promise.resolve(model) : Promise.reject(new Error(`no model ${modelId}`))
    },

    familyOf: modelId => found(modelId)?.family ?? null,

    fieldsOf: modelId => found(modelId)?.fields ?? [],

    generate: async (modelId, body) => {
      const model = found(modelId)
      const output = model && OUTPUT[model.family]
      if (!model || !output) throw new Error(`no model ${modelId}`)

      runs += 1
      const id = `job-${runs}`
      const label = nameOfRun(model.name, body)
      const name = assetFileName(label, `.${output.extension}`)
      const path = pathIn(defaultAssetFolder(output), name)
      const asset: Asset = {
        id: `generated-${runs}`,
        name,
        type: output.type,
        ...(output.map ? { map: output.map } : {}),
        location: 'local',
        path,
        tags: [],
        createdAt: WHEN,
        jobId: id,
      }

      await folder.createFolder(defaultAssetFolder(output))
      await folder.write(path)
      await catalog.add(asset)

      return {
        id,
        targetId: modelId,
        label,
        status: 'succeeded',
        progress: 1,
        createdAt: WHEN,
        finishedAt: WHEN,
        assetIds: [asset.id],
      }
    },
  }
}
