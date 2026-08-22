import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AiOverview, RoleRow } from '@shared/domain/aiOverview'
import { aiRoleId } from '@shared/domain/aiRole'
import { localModel } from '@shared/domain/localModel-fixtures'
import { useAiModels } from '@/stores/aiModels'
import { useModels } from '@/stores/models'
import { preferModels } from '@/stores/settings-fixtures'
import { useModelForFamily } from '@/hooks/useModelForFamily'
import { modelForFamily, modelIsOnThisMachine } from './modelForFamily'

const imageRow = (over: Partial<RoleRow> = {}): RoleRow => ({
  role: aiRoleId('image', 'txt2img'),
  provider: null,
  chosen: { app: null, project: null },
  candidates: [
    {
      model: localModel({ id: 'ssd-1b' }),
      installed: true,
      loaded: false,
      holdable: true,
      unverified: false,
      supplied: false,
      serves: 1,
      fit: 'compatible',
      obstacle: null,
    },
  ],
  clouds: ['scenario'],
  ...over,
})

const overviewOf = (row: RoleRow): AiOverview => ({
  roles: [row],
  machine: { physicalBytes: 1, availableBytes: 1, diskFreeBytes: 1, gpu: null, vram: null },
  projectPath: null,
  installing: null,
  loading: null,
  loadFailure: null,
  ollama: { ready: false, installed: false, names: [], progress: null, failed: false },
})

beforeEach(() => {
  preferModels()
  useModels.setState({ selected: {} })
  useAiModels.setState({ overview: null })
})

/**
 * The two forms answer one question, so they are tested against the same cases: the day they
 * disagree is the day a panel says a model is there and the one beside it says it is not.
 */
describe.each([
  ['read once', () => modelForFamily('image') ?? null],
  ['subscribed', () => renderHook(() => useModelForFamily('image')).result.current],
])('the model a family generates with, %s', (_form, read) => {
  it('takes the one chosen in the panel', () => {
    useModels.setState({ selected: { image: 'flux' } })

    expect(read()).toBe('flux')
  })

  it('falls back to the one the settings name', () => {
    preferModels({ image: 'sdxl' })

    expect(read()).toBe('sdxl')
  })

  /** A preference is where to start from, never what was decided — reversing it is the one
   * mistake a helper written to reconcile three callers can make silently. */
  it('lets the choice win over the preference', () => {
    preferModels({ image: 'sdxl' })
    useModels.setState({ selected: { image: 'flux' } })

    expect(read()).toBe('flux')
  })
})

it('recognises a model of this machine from the overview', () => {
  expect(modelIsOnThisMachine('ssd-1b', null)).toBe(false)
  expect(modelIsOnThisMachine('ssd-1b', overviewOf(imageRow()))).toBe(true)
  expect(modelIsOnThisMachine('flux', overviewOf(imageRow()))).toBe(false)
})

it('honours a local employment over the panel leftover', () => {
  useModels.setState({ selected: { image: 'flux' } })
  useAiModels.setState({
    overview: overviewOf(imageRow({ provider: { kind: 'local', modelId: 'ssd-1b' } })),
  })

  expect(modelForFamily('image')).toBe('ssd-1b')
})

it('does not send a local leftover when the employment is a cloud', () => {
  useModels.setState({ selected: { image: 'ssd-1b' } })
  preferModels({ image: 'flux' })
  useAiModels.setState({
    overview: overviewOf(imageRow({ provider: { kind: 'cloud', providerId: 'scenario' } })),
  })

  expect(modelForFamily('image')).toBe('flux')
})

/** Only the subscribed form takes one: the rail asks about the home, which generates nothing. */
it('answers nothing for no family at all', () => {
  preferModels({ image: 'sdxl' })

  expect(renderHook(() => useModelForFamily(null)).result.current).toBeNull()
})
