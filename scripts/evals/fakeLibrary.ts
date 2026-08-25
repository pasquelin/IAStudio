import type { ActionOutcome } from '@shared/domain/assistant'
import { isRecord } from '@shared/guards'
import { matchesWords, searchWords } from '@shared/text'
import { answered, done, nextId, refused, type Bench, type CatalogueAsset } from './bench'
import { byId, text, texts, type Input } from './inputs'

/**
 * The library and the generator — sections 20 to 23, and the id every material slot takes.
 *
 * A generation is answered SYNCHRONOUSLY here: the job lands `success` with an asset already in
 * the catalogue. A bench that made the model poll would measure patience, not choice.
 */

// The families the registry declares, and `3d` is one of them — never `model`, which is what a
// bench spelling its own list would have accepted and the studio refused.
const MODELS: readonly { id: string; family: string }[] = [
  { id: 'flux.1-dev', family: 'image' },
  { id: 'video-gen-1', family: 'video' },
  { id: 'mesh-gen-1', family: '3d' },
  { id: 'texture-gen-1', family: 'texture' },
  { id: 'skybox-gen-1', family: 'skybox' },
  { id: 'audio-gen-1', family: 'audio' },
]

const NAMED_BY_FAMILY: Record<string, string> = {
  image: 'image',
  video: 'video',
  '3d': 'mesh',
  texture: 'texture',
  skybox: 'skybox',
  audio: 'audio',
}

const shown = (one: CatalogueAsset): unknown => ({
  id: one.id,
  name: one.name,
  type: one.type,
  path: one.path,
  tags: one.tags,
  generated: one.jobId !== null,
})

function generate(bench: Bench): ActionOutcome {
  const form = bench.prepared
  if (!form) return refused('nothingPrepared')

  const asked = form.parameters
  const prompt = text(asked, 'prompt')
  const job = {
    id: nextId(bench, 'job'),
    family: form.family,
    modelId: form.modelId,
    prompt,
    // What "use this picture as a reference" has to land in, whatever the model spells it.
    // Four spellings for one thing: what the person pointed at has to land here whichever key
    // the model chose, or « utilise cette image comme référence » is scored on nothing.
    references: [
      ...texts(asked, 'referenceAssetIds'),
      ...texts(asked, 'images'),
      ...[text(asked, 'referenceAssetId'), text(asked, 'image')].filter(one => one !== ''),
    ],
    status: 'success',
    assetIds: [] as string[],
  }

  const asset: CatalogueAsset = {
    id: nextId(bench, 'asset'),
    name: prompt || 'Generated',
    type: NAMED_BY_FAMILY[form.family] ?? 'image',
    path: null,
    jobId: job.id,
    tags: [],
  }
  job.assetIds.push(asset.id)
  bench.assets.push(asset)
  bench.jobs.push(job)
  bench.prepared = null
  return answered({ jobId: job.id, assetIds: job.assetIds })
}

export function libraryAction(bench: Bench, action: string, input: Input): ActionOutcome | null {
  switch (action) {
    case 'assets.search': {
      const words = searchWords(text(input, 'text'))
      const kind = text(input, 'type')
      const generated = input['generated'] === true
      return answered(
        bench.assets
          .filter(one => words.length === 0 || matchesWords(`${one.path ?? ''} ${one.name}`, words))
          .filter(one => kind === '' || one.type === kind)
          .filter(one => !generated || one.jobId !== null)
          .map(shown),
      )
    }

    case 'assets.counts': {
      const counts: Record<string, number> = {}
      for (const one of bench.assets) counts[one.type] = (counts[one.type] ?? 0) + 1
      return answered(counts)
    }

    case 'asset.get': {
      const wanted = texts(input, 'assetIds')
      return answered(bench.assets.filter(one => wanted.includes(one.id)).map(shown))
    }

    case 'asset.update': {
      const asset = byId(bench.assets, input, 'assetId')
      if (!asset) return refused('notFound')

      if (text(input, 'name') !== '') asset.name = text(input, 'name')
      if (input['tags'] !== undefined) asset.tags = [...texts(input, 'tags')]
      if (text(input, 'type') !== '') asset.type = text(input, 'type')
      return done
    }

    case 'assets.remove': {
      const wanted = texts(input, 'assetIds')
      bench.assets = bench.assets.filter(one => !wanted.includes(one.id))
      return done
    }

    case 'asset.extractTextures': {
      const asset = byId(bench.assets, input, 'assetId')
      if (!asset) return refused('notFound')

      // A model carries its maps; pulling them out is how "its textures" become ids.
      const pulled = bench.assets.filter(one => one.type === 'texture').map(one => one.id)
      return answered({ assetIds: pulled })
    }

    case 'models.search': {
      const words = searchWords(text(input, 'query'))
      const family = text(input, 'family')
      return answered(
        MODELS.filter(one => family === '' || one.family === family).filter(
          one => words.length === 0 || matchesWords(`${one.id} ${one.family}`, words),
        ),
      )
    }

    case 'models.select': {
      const model = MODELS.find(one => one.id === text(input, 'modelId'))
      if (!model || text(input, 'family') === '') return refused('notFound')

      bench.armed[text(input, 'family')] = model.id
      return done
    }

    case 'generator.prepare': {
      const family = text(input, 'family')
      const modelId = text(input, 'modelId') || bench.armed[family] || ''
      const parameters = isRecord(input['parameters']) ? input['parameters'] : {}
      if (family === '' || modelId === '') return refused('badInput')

      bench.prepared = { family, modelId, parameters }
      return done
    }

    case 'generator.submit':
      return generate(bench)

    case 'jobs.list':
      return answered(bench.jobs.map(one => ({ id: one.id, status: one.status })))

    case 'job.get':
    case 'job.wait': {
      const job = bench.jobs.find(one => one.id === text(input, 'jobId'))
      if (!job) return refused('notFound')

      return answered({ id: job.id, status: job.status, metadata: { assetIds: job.assetIds } })
    }

    case 'cost.estimate':
      return answered({ credits: 1 })

    case 'model.schema':
      return answered({ fields: [{ key: 'prompt', kind: 'text', required: true }] })

    case 'auth.state':
      return answered({ authenticated: true })

    case 'usage.report':
      return answered({ credits: 0 })

    default:
      return null
  }
}
