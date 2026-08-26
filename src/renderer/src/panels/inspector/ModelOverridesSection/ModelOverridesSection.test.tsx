import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AssetQuery } from '@shared/domain/asset'
import type { ModelRef } from '@shared/domain/scene'
import { installFakeBridge } from '@/services/fakeBridge'
import { ModelOverridesSection } from './ModelOverridesSection'

const MODEL = 'asset-model'

const texture = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-base',
  name: 'Robot — Couleur de base',
  type: 'texture',
  location: 'local',
  derivedFrom: MODEL,
  map: 'baseColor',
  tags: [],
  createdAt: '2026-08-13T10:00:00.000Z',
  ...overrides,
})

let derived: Asset[] = []
const search = vi.fn((query: AssetQuery) =>
  Promise.resolve(query.derivedFrom === MODEL ? derived : []),
)

const onChange = vi.fn()

function showFolded(textures: ModelRef['textures'] = undefined): void {
  render(
    <ModelOverridesSection
      assetId={MODEL}
      textures={textures}
      onChange={onChange}
      onFinish={() => {}}
    />,
  )
}

describe('ModelOverridesSection', () => {
  beforeEach(() => {
    derived = [texture()]
    search.mockClear()
    onChange.mockClear()
    installFakeBridge({ assets: { search } })
  })

  // The fold unmounts, so a panel nobody opened must not have asked the catalogue anything.
  it('asks the catalogue nothing while it is folded', () => {
    showFolded()

    expect(search).not.toHaveBeenCalled()
  })
})
