import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { AssetPicker } from '@/features/shell/components/AssetPicker/AssetPicker'
import { installFakeBridge } from '@/services/fakeBridge'
import { ModelDressSection } from './ModelDressSection'

const PICTURES: Asset[] = [
  {
    id: 'current',
    name: 'Current texture',
    type: 'image',
    location: 'local',
    path: 'Textures/current.png',
    tags: [],
    createdAt: '2026-09-04T10:00:00.000Z',
  },
  {
    id: 'replacement',
    name: 'Replacement texture',
    type: 'image',
    location: 'local',
    path: 'Textures/replacement.png',
    tags: [],
    createdAt: '2026-09-04T10:00:00.000Z',
  },
]

describe('model image dress', () => {
  it('offers neither the file nor extraction once no embedded texture remains', () => {
    installFakeBridge({ assets: { search: () => Promise.resolve([]) } })

    render(
      <ModelDressSection
        assetId="model"
        name="Model"
        dress={undefined}
        slots={1}
        extractable
        ownTextures={false}
        onChange={vi.fn()}
        onWearAt={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Recouvert par' })).toHaveValue('image')
    expect(screen.queryByRole('option', { name: 'Celle de son fichier' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Extraire/ })).not.toBeInTheDocument()
  })

  it('chooses its texture through the shared picture picker', async () => {
    installFakeBridge({ assets: { search: () => Promise.resolve(PICTURES) } })
    const onChange = vi.fn()

    render(
      <>
        <ModelDressSection
          assetId="model"
          name="Model"
          dress={{ kind: 'image', assetId: 'current' }}
          slots={1}
          extractable
          onChange={onChange}
          onWearAt={vi.fn()}
        />
        <AssetPicker />
      </>,
    )

    await userEvent.click(screen.getByRole('button', { name: /Parcourir les images/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Replacement texture/ }))

    expect(onChange).toHaveBeenCalledWith({ kind: 'image', assetId: 'replacement' })
  })
})
