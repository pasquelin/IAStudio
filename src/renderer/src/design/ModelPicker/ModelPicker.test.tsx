import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LOCAL_RUNTIME, type ModelSummary } from '@shared/domain/model'
import { ModelPicker } from './ModelPicker'

const model = (over: Partial<ModelSummary> & { id: string }): ModelSummary => ({
  name: over.id,
  family: 'image',
  runsOn: 'scenario',
  source: 'scenario',
  origin: 'community',
  featured: false,
  capabilities: ['txt2img'],
  tags: [],
  ...over,
})

const MODELS: readonly ModelSummary[] = [
  model({ id: 'ssd-1b', name: 'SSD-1B', runsOn: LOCAL_RUNTIME, installed: true }),
  model({ id: 'sana', name: 'Sana 600M', runsOn: LOCAL_RUNTIME, installed: false }),
  model({ id: 'flux', name: 'Flux' }),
]

function open(over: Partial<Parameters<typeof ModelPicker>[0]> = {}) {
  const onChange = vi.fn()
  render(
    <ModelPicker
      models={MODELS}
      value="ssd-1b"
      onChange={onChange}
      emptyLabel="Choisir un modèle"
      {...over}
    />,
  )

  return { onChange }
}

describe('the model in use', () => {
  it('is what the closed control names', () => {
    open()

    expect(screen.getByRole('button', { name: /SSD-1B/ })).toBeInTheDocument()
  })

  // § 20: the panel says what stands in the way rather than letting a click end in a 403.
  it('says so when nothing serves the employment yet', () => {
    open({ value: null })

    expect(screen.getByRole('button', { name: 'Choisir un modèle' })).toBeInTheDocument()
  })
})

describe('choosing another one', () => {
  /**
   * § 15: it opens a flyout rather than replacing what is around it. Choosing a model is a step
   * of a generation, not a destination — the prompt above it has to stay on screen.
   */
  it('opens a menu without taking the panel away', async () => {
    open()

    await userEvent.click(screen.getByRole('button', { name: /SSD-1B/ }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(MODELS.length)
  })

  it('answers with the model that was picked', async () => {
    const { onChange } = open()

    await userEvent.click(screen.getByRole('button', { name: /SSD-1B/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Flux/ }))

    expect(onChange).toHaveBeenCalledWith('flux')
  })

  it('closes once one is picked', async () => {
    open()

    await userEvent.click(screen.getByRole('button', { name: /SSD-1B/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Flux/ }))

    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('narrowing the list', () => {
  it('keeps only what the search names', async () => {
    open()

    await userEvent.click(screen.getByRole('button', { name: /SSD-1B/ }))
    await userEvent.type(screen.getByRole('searchbox'), 'sana')

    expect(screen.getAllByRole('menuitem')).toHaveLength(1)
  })

  it('keeps only what runs on this machine', async () => {
    open()

    await userEvent.click(screen.getByRole('button', { name: /SSD-1B/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Local' }))

    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
  })

  /**
   * A cloud model has nothing to install, so greying it under this facet would say it is
   * missing — which is exactly what "installed" must not come to mean.
   */
  it('keeps a cloud model under the installed facet, having nothing to install', async () => {
    open()

    await userEvent.click(screen.getByRole('button', { name: /SSD-1B/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Installé' }))

    expect(screen.getAllByRole('menuitem').map(row => row.textContent)).toEqual([
      expect.stringContaining('SSD-1B'),
      expect.stringContaining('Flux'),
    ])
  })

  it('says so when the narrowing matches nothing', async () => {
    open()

    await userEvent.click(screen.getByRole('button', { name: /SSD-1B/ }))
    await userEvent.type(screen.getByRole('searchbox'), 'nothing of the sort')

    expect(screen.queryAllByRole('menuitem')).toEqual([])
  })
})

// § 20 again, one row at a time: a download and a subscription are not the same gesture, and the
// difference has to be readable before the click rather than after it.
it('says on the row what stands between a model and a generation', async () => {
  open({ refusalOf: candidate => (candidate.installed === false ? 'Non installé' : undefined) })

  await userEvent.click(screen.getByRole('button', { name: /SSD-1B/ }))

  expect(screen.getByRole('menuitem', { name: /Sana 600M/ })).toHaveTextContent('Non installé')
})
