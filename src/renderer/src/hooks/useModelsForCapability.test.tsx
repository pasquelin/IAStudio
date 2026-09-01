import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aiRoleId } from '@shared/domain/aiRole'
import {
  LOCAL_RUNTIME,
  type ModelPage,
  type ModelQuery,
  type ModelSummary,
} from '@shared/domain/model'
import { queryHost } from '@/features/shell/components/query-fixtures'
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

/** The catalogue asks the hook makes, which is not the same question as what it draws. */
const walked = (): (ModelQuery | undefined)[] =>
  searchModels.mock.calls.map(([query]) => query).filter(query => query?.runsOn !== LOCAL_RUNTIME)

beforeEach(() => {
  searchModels.mockClear()
  // Module state: without this a case inherits whatever resolver the one before it left behind.
  releaseCatalogue = () => {}
})

describe('the models one employment is served by', () => {
  /**
   * 🛑 Measured at 4,99 s: the manifests are held in memory and cost nothing, but they used to
   * ride in the same promise as the catalogue walk — so a model on this disk waited on five
   * listings in series over a network it does not need.
   */
  it('draws what is on this machine without waiting on the catalogue', async () => {
    const { result } = renderHook(() => useModelsForCapability(ROLE), { wrapper: queryHost() })

    // Waited on the answer rather than on a delay: react-query's chain settles in its own time,
    // and a fixed ten milliseconds is a race this test lost on a loaded machine.
    await waitFor(() => expect(result.current.map(one => one.id)).toEqual(['ssd-1b']))
  })

  it('hands over to the catalogue once its first page lands, without doubling a row', async () => {
    const { result } = renderHook(() => useModelsForCapability(ROLE), { wrapper: queryHost() })
    // The walk has to have STARTED, or `releaseCatalogue` is still the no-op it opens on.
    await waitFor(() => expect(walked()).not.toHaveLength(0))

    releaseCatalogue({
      items: [model('ssd-1b', LOCAL_RUNTIME), model('flux', 'scenario')],
      cursor: null,
    })

    await waitFor(() => expect(result.current.map(one => one.id)).toEqual(['ssd-1b', 'flux']))
  })

  // The walk pages a hundred records at a time and stops on MATCHES, so a wide first ask is what
  // multiplied the round trips — the rest of the hundred arrives behind the paint.
  it('asks its first page small rather than the whole picker', async () => {
    renderHook(() => useModelsForCapability(ROLE), { wrapper: queryHost() })
    await waitFor(() => expect(walked()).not.toHaveLength(0))

    expect(walked()[0]?.limit).toBeLessThan(30)
  })
})
