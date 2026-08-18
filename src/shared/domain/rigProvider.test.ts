import { describe, expect, it } from 'vitest'
import type { ModelSummary } from './model'
import { motionProvidersOf, rigProvidersOf, rigRefusalOf, type RigProvider } from './rigProvider'

function model(
  id: string,
  tags: readonly string[],
  extra: Partial<ModelSummary> = {},
): ModelSummary {
  return {
    id,
    name: id,
    family: '3d',
    source: 'other',
    origin: 'official',
    featured: false,
    capabilities: ['3d23d'],
    tags,
    ...extra,
  }
}

/** The five riggers and the neighbours they share `3d23d` with — measured on 2026-08-18. */
const CATALOGUE: ModelSummary[] = [
  model('model_uthana-character-rigging', ['3D', 'Character', 'Rigging', 'Uthana']),
  model('model_tripo-rigging-v1', ['3d', 'Rigging', 'Tripo', 'animation']),
  model('model_meshy-rigging', ['3D to 3D', 'Meshy', 'Rigging']),
  model('model_meshy-animation', ['3D', 'Animation', 'Meshy']),
  model('model_meshy-remesh', ['3D to 3D', 'Meshy', 'Remeshing', 'remesh']),
  model('model_tripo-retopology', ['3D', 'Low Poly', 'Retopology', 'Tripo']),
  model('model_uthana-text-to-motion-3.0', ['3D', 'Animation', 'Motion', 'Uthana'], {
    capabilities: ['txt23d'],
  }),
]

describe('finding the services that can rig a mesh', () => {
  // The capability alone answers nineteen models and only five of them rig: remesh, retexture,
  // unwrap, segment and animate all live under `3d23d` too.
  it('keeps the riggers and leaves their nineteen neighbours out', () => {
    expect(rigProvidersOf(CATALOGUE).map(provider => provider.modelId)).toEqual([
      'model_uthana-character-rigging',
      'model_tripo-rigging-v1',
      'model_meshy-rigging',
    ])
  })

  it('reads the tag whatever case it was written in, since three spellings are in the catalogue', () => {
    expect(rigProvidersOf([model('a', ['rigging'])])).toHaveLength(1)
  })

  it('leaves out a model that rigs nothing however it is tagged', () => {
    expect(rigProvidersOf([model('a', ['Rigging'], { capabilities: ['txt2img'] })])).toEqual([])
  })

  it('carries the grade the API refuses it below, which is what greys the row', () => {
    const graded = model('a', ['Rigging'], { requiredPlanLevel: 50 })

    expect(rigProvidersOf([graded])[0]?.requiredPlanLevel).toBe(50)
  })
})

describe('finding the services that make a motion', () => {
  // Counted on screen against the real account: six, and the `Rigging` half of the test is what
  // keeps the two Tripo riggers out — both carry `Animation` as well.
  it('keeps what animates and leaves what rigs out, though both are tagged Animation', () => {
    expect(motionProvidersOf(CATALOGUE).map(provider => provider.modelId)).toEqual([
      'model_meshy-animation',
      'model_uthana-text-to-motion-3.0',
    ])
  })

  it('takes a motion model whatever it reads, since they span three capabilities', () => {
    const video = model('a', ['Motion'], { capabilities: ['video23d'] })

    expect(motionProvidersOf([video])).toHaveLength(1)
  })
})

describe('saying why a service cannot run', () => {
  const PRO: RigProvider = { modelId: 'a', name: 'A', requiredPlanLevel: 50 }
  const basic = { name: 'cu-basic', level: 25 }

  it('refuses one the plan does not reach, before anything is clicked', () => {
    expect(rigRefusalOf(PRO, basic, { bytes: 10, maxSize: 100 })).toEqual({ kind: 'plan' })
  })

  it('names the limit rather than sending a file that will be refused after minutes of upload', () => {
    const allowed = { modelId: 'a', name: 'A' }

    expect(rigRefusalOf(allowed, basic, { bytes: 30000001, maxSize: 30000000 })).toEqual({
      kind: 'too-large',
      maxSize: 30000000,
    })
  })

  it('accepts a mesh exactly at the limit', () => {
    expect(
      rigRefusalOf({ modelId: 'a', name: 'A' }, basic, { bytes: 100, maxSize: 100 }),
    ).toBeNull()
  })

  it('refuses nothing on a model that names no limit', () => {
    expect(rigRefusalOf({ modelId: 'a', name: 'A' }, basic, { bytes: 1e9 })).toBeNull()
  })

  // Being wrong about a plan hides a service the user is paying for, which is the one failure
  // worth avoiding — the same rule `isBeyondPlan` states.
  it('refuses nothing when the plan could not be read', () => {
    expect(rigRefusalOf(PRO, null, { bytes: 10, maxSize: 100 })).toBeNull()
  })
})
