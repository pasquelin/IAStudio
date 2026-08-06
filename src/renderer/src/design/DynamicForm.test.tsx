import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import { DynamicForm } from './DynamicForm'

function field(overrides: Partial<FieldDescriptor> & { key: string }): FieldDescriptor {
  return { kind: 'text', label: overrides.key, required: false, ...overrides }
}

function renderForm(fields: FieldDescriptor[]) {
  const onSubmit = vi.fn()
  render(<DynamicForm fields={fields} onSubmit={onSubmit} submitLabel="Générer" />)
  return onSubmit
}

describe('DynamicForm', () => {
  it('renders one control per kind', () => {
    renderForm([
      field({ key: 'prompt', label: 'Prompt', kind: 'longText' }),
      field({ key: 'steps', label: 'Étapes', kind: 'integer' }),
      field({ key: 'hires', label: 'Haute résolution', kind: 'boolean' }),
      field({
        key: 'mode',
        label: 'Mode',
        kind: 'choice',
        options: [{ value: 'txt2img', label: 'Texte' }],
      }),
    ])

    expect(screen.getByLabelText(/Prompt/).tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText(/Étapes/)).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText(/Haute résolution/)).toHaveAttribute('type', 'checkbox')
    expect(screen.getByLabelText(/Mode/).tagName).toBe('SELECT')
  })

  // A model Scenario just added must stay usable — CLAUDE.md, invariant 5.
  it('renders an unknown kind as free input rather than dropping the form', () => {
    renderForm([field({ key: 'mystery', label: 'Mystère', kind: 'raw' })])
    expect(screen.getByLabelText(/Mystère/)).toHaveAttribute('type', 'text')
  })

  it('says so when a model takes no parameter, instead of showing nothing', () => {
    renderForm([])
    expect(screen.getByText('Ce modèle n’attend aucun paramètre.')).toBeInTheDocument()
  })

  it('submits only what was filled in', async () => {
    const onSubmit = renderForm([
      field({ key: 'prompt', label: 'Prompt', required: true }),
      field({ key: 'negative', label: 'Négatif' }),
    ])

    await userEvent.type(screen.getByLabelText(/Prompt/), 'un rocher')
    await userEvent.click(screen.getByRole('button', { name: 'Générer' }))

    expect(onSubmit).toHaveBeenCalledWith({ prompt: 'un rocher' })
  })

  it('refuses to submit while a required field is empty', async () => {
    const onSubmit = renderForm([field({ key: 'prompt', label: 'Prompt', required: true })])

    await userEvent.click(screen.getByRole('button', { name: 'Générer' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Valeur invalide.')
  })

  it('hides a field until its dependency is satisfied', async () => {
    renderForm([
      field({
        key: 'mode',
        label: 'Mode',
        kind: 'choice',
        options: [
          { value: 'txt2img', label: 'Texte' },
          { value: 'img2img', label: 'Image' },
        ],
      }),
      field({ key: 'strength', label: 'Force', dependsOn: { key: 'mode', value: 'img2img' } }),
    ])

    expect(screen.queryByLabelText(/Force/)).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText(/Mode/), 'img2img')
    expect(screen.getByLabelText(/Force/)).toBeInTheDocument()
  })

  it('rolls a new seed on demand', async () => {
    renderForm([field({ key: 'seed', label: 'Graine', kind: 'seed' })])

    const input = screen.getByLabelText(/Graine/)
    expect(input).toHaveValue(null)

    await userEvent.click(screen.getByRole('button', { name: 'Aléatoire' }))
    expect(input).not.toHaveValue(null)
  })

  it('groups the fields the model asked to group', () => {
    renderForm([
      field({ key: 'prompt', label: 'Prompt' }),
      field({ key: 'steps', label: 'Étapes', kind: 'integer', group: 'Avancé' }),
    ])

    expect(screen.getByRole('group', { name: 'Avancé' })).toBeInTheDocument()
  })
})
