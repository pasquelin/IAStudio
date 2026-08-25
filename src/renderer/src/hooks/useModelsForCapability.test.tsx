import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aiRoleId } from '@shared/domain/aiRole'
import {
  LOCAL_RUNTIME,
  type ModelPage,
  type ModelQuery,
  type ModelSummary,
} from '@shared/domain/model'
import { queryHost } from '@/app/query-fixtures'
import { useModelsForCapability } from './useModelsForCapability'

const model = (id: string, runsOn: string): ModelSummary => ({
  id,
  name: id,
  family: 'image',
  runsOn,
  source: 'scenario',
  origin: 'community',
  featured: false,
  capabilities: ['txt2img'],
  tags: [],
})

/** The catalogue walk, held open until a case lets it answer — the network it stands for. */
let releaseCatalogue: (page: ModelPage) => void = () => {}

const searchModels = vi.fn((query?: ModelQuery): Promise<ModelPage> =>
  query?.runsOn === LOCAL_RUNTIME
    ? Promise.resolve({ items: [model('ssd-1b', LOCAL_RUNTIME)], cursor: null })
    : new Promise<ModelPage>(resolve => {
        releaseCatalogue = resolve
      }),
)

vi.mock('@/services/bridge', () => ({
  getBridge: () => ({ provider: { searchModels: (query?: ModelQuery) => searchModels(query) } }),
}))

const ROLE = aiRoleId('image', 'txt2img')

/** Lets every answer already settled reach the hook, react-query's own chain included. */
const settle = () => act(async () => void (await new Promise(resolve => setTimeout(resolve, 10))))

beforeEach(() => {
  searchModels.mockClear()
})

describe('the models one employment is served by', () => {
  /**
   * 🛑 Measured at 4,99 s: the manifests are held in memory and cost nothing, but they used to
   * ride in the same promise as the catalogue walk — so a model on this disk waited on five
   * listings in series over a network it does not need.
   */
  it('draws what is on this machine without waiting on the catalogue', async () => {
    const { result } = renderHook(() => useModelsForCapability(ROLE), { wrapper: queryHost() })

    await settle()

    expect(result.current.map(one => one.id)).toEqual(['ssd-1b'])
  })

  it('hands over to the catalogue once its first page lands, without doubling a row', async () => {
    const { result } = renderHook(() => useModelsForCapability(ROLE), { wrapper: queryHost() })
    await settle()

    releaseCatalogue({
      items: [model('ssd-1b', LOCAL_RUNTIME), model('flux', 'scenario')],
      cursor: null,
    })
    await settle()

    expect(result.current.map(one => one.id)).toEqual(['ssd-1b', 'flux'])
  })

  // The walk pages a hundred records at a time and stops on MATCHES, so a wide first ask is what
  // multiplied the round trips — the rest of the hundred arrives behind the paint.
  it('asks its first page small rather than the whole picker', async () => {
    renderHook(() => useModelsForCapability(ROLE), { wrapper: queryHost() })
    await settle()

    const walked = searchModels.mock.calls
      .map(([query]) => query)
      .filter(query => query?.runsOn !== LOCAL_RUNTIME)

    expect(walked[0]?.limit).toBeLessThan(30)
  })
})
