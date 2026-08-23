import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ModelSummary } from '@shared/domain/model'
import { ModelsRow } from './ModelsRow'

function model(over: Partial<ModelSummary> = {}): ModelSummary {
  return {
    id: 'triposr',
    name: 'TripoSR',
    family: '3d',
    runsOn: 'local',
    source: 'https://example.invalid',
    origin: 'community',
    featured: false,
    capabilities: ['img23d'],
    tags: [],
    ...over,
  }
}

describe('ModelsRow', () => {
  it('puts the quality line under the name when the catalogue supplied one', () => {
    render(
      <ModelsRow
        model={model({ description: '2024 · Fastest open image-to-mesh', featured: true })}
      />,
    )

    expect(screen.getByText('TripoSR')).toBeInTheDocument()
    expect(screen.getByText('Mis en avant · 2024 · Fastest open image-to-mesh')).toBeInTheDocument()
  })
})
