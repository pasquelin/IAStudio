import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import { field } from '@/helpers/dynamic-form-fixtures'
import { DynamicForm } from './DynamicForm'

function renderForm(fields: FieldDescriptor[]) {
  const onSubmit = vi.fn()
  render(<DynamicForm fields={fields} onSubmit={onSubmit} submitLabel="Générer" />)
  return onSubmit
}

describe('a picture the form opens on', () => {
  /**
   * The picture field showed the descriptor's own default and never the preset, so an edit that
   * had just flattened the document, uploaded it and filled the form left the field looking
   * empty — the one thing the user is being asked to review before paying for the generation.
   */
  it('shows the one a preset carries, not only the descriptor default', () => {
    const { container } = render(
      <DynamicForm
        fields={[{ key: 'image', kind: 'image', label: 'Image', required: true }]}
        onSubmit={vi.fn()}
        submitLabel="Générer"
        preset={{ image: 'asset-flat' }}
      />,
    )

    expect(container.querySelector('img')).not.toBeNull()
  })
})

describe('DynamicForm', () => {
  it('renders one control per kind', () => {
    renderForm([
      field({ key: 'prompt', label: 'Prompt', kind: 'longText' }),
      field({ key: 'steps', label: 'Steps', kind: 'integer' }),
      field({ key: 'hires', label: 'High resolution', kind: 'boolean' }),
      field({
        key: 'mode',
        label: 'Mode',
        kind: 'choice',
        options: [{ value: 'txt2img', label: 'Text' }],
      }),
    ])

    expect(screen.getByLabelText(/Prompt/).tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText(/Steps/)).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText(/High resolution/)).toHaveAttribute('type', 'checkbox')
    expect(screen.getByLabelText(/Mode/).tagName).toBe('SELECT')
  })

  // A model Scenario just added must stay usable — CLAUDE.md, invariant 5.
  it('renders an unknown kind as free input rather than dropping the form', () => {
    renderForm([field({ key: 'mystery', label: 'Mystery', kind: 'raw' })])
    expect(screen.getByLabelText(/Mystery/)).toHaveAttribute('type', 'text')
  })

  it('says so when a model takes no parameter, instead of showing nothing', () => {
    renderForm([])
    expect(screen.getByText('Ce modèle n’attend aucun paramètre.')).toBeInTheDocument()
  })

  it('submits only what was filled in', async () => {
    const onSubmit = renderForm([
      field({ key: 'prompt', label: 'Prompt', required: true }),
      field({ key: 'negative', label: 'Negative' }),
    ])

    await userEvent.type(screen.getByLabelText(/Prompt/), 'a boulder')
    await userEvent.click(screen.getByRole('button', { name: 'Générer' }))

    expect(onSubmit).toHaveBeenCalledWith({ prompt: 'a boulder' })
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
          { value: 'txt2img', label: 'Text' },
          { value: 'img2img', label: 'Image' },
        ],
      }),
      field({ key: 'strength', label: 'Strength', dependsOn: { key: 'mode', value: 'img2img' } }),
    ])

    expect(screen.queryByLabelText(/Intensité/)).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText(/Mode/), 'img2img')
    expect(screen.getByLabelText(/Intensité/)).toBeInTheDocument()
  })

  it('rolls a new seed on demand', async () => {
    renderForm([field({ key: 'seed', label: 'Seed', kind: 'seed' })])

    const input = screen.getByLabelText(/Graine/)
    expect(input).toHaveValue(null)

    await userEvent.click(screen.getByRole('button', { name: 'Aléatoire' }))
    expect(input).not.toHaveValue(null)
  })

  // A seed registered as a string was validated against a number: a hand-typed one never
  // passed, and only the roll button worked.
  it('submits a hand-typed seed as a number', async () => {
    const onSubmit = renderForm([field({ key: 'seed', label: 'Seed', kind: 'seed' })])

    await userEvent.type(screen.getByLabelText(/Graine/), '1234')
    await userEvent.click(screen.getByRole('button', { name: 'Générer' }))

    expect(onSubmit).toHaveBeenCalledWith({ seed: 1234 })
  })

  it('groups the fields the model asked to group', () => {
    renderForm([
      field({ key: 'prompt', label: 'Prompt' }),
      field({ key: 'steps', label: 'Steps', kind: 'integer', group: 'Advanced' }),
    ])

    expect(screen.getByRole('group', { name: 'Avancé' })).toBeInTheDocument()
  })

  describe('the accessory a caller hangs under a field', () => {
    const fields = [
      field({ key: 'prompt', label: 'Prompt', kind: 'longText' }),
      field({ key: 'steps', label: 'Steps', kind: 'integer' }),
    ]

    it('is offered every field, so nothing about any feature is decided here', () => {
      const seen = new Set<string>()
      render(
        <DynamicForm
          fields={fields}
          onSubmit={vi.fn()}
          submitLabel="Générer"
          accessory={shown => {
            seen.add(shown.key)
            return null
          }}
        />,
      )

      expect([...seen]).toEqual(['prompt', 'steps'])
    })

    /**
     * Two cases stood here and went with the handle they exercised — writing one field without
     * disturbing the others, and reading a field as it stands rather than as it was drawn. They
     * described `FieldHandle`, which nothing reads any more: prompt assistance rewrote the field
     * it hung under, and that moved to the assistant, which reaches the form another way.
     */
    it('hangs nothing on a field the caller passes over', () => {
      render(
        <DynamicForm
          fields={fields}
          onSubmit={vi.fn()}
          submitLabel="Générer"
          accessory={shown => shown.key === 'prompt' && <span>Sous le prompt</span>}
        />,
      )

      expect(screen.getAllByText('Sous le prompt')).toHaveLength(1)
    })

    // A button nested in a label steals the click meant for the field it labels.
    it('sits outside the label rather than inside it', () => {
      render(
        <DynamicForm
          fields={[fields[0] ?? field({ key: 'prompt' })]}
          onSubmit={vi.fn()}
          submitLabel="Générer"
          accessory={() => (
            <button type="button" onClick={() => {}}>
              Adopter
            </button>
          )}
        />,
      )

      expect(screen.getByRole('button', { name: 'Adopter' }).closest('label')).toBeNull()
    })
  })
})

/**
 * The panel used to read half in French and half in English: the chassis is the studio's and
 * was translated, the fields belong to the model and Scenario answers in English only.
 */
describe('what the model itself wrote', () => {
  it('is read out in French, label, description and group heading alike', () => {
    render(
      <DynamicForm
        fields={[
          field({ key: 'video', label: 'Video', group: 'SETTINGS' }),
          field({
            key: 'targetSize',
            label: 'Target size',
            help: 'Inference resolution; higher is sharper but slower.',
            group: 'SETTINGS',
          }),
        ]}
        onSubmit={vi.fn()}
        submitLabel="Générer"
      />,
    )

    expect(screen.getByText('Réglages')).toBeDefined()
    expect(screen.getByText('Vidéo')).toBeDefined()
    expect(screen.getByText('Taille cible')).toBeDefined()
    expect(screen.getByText(/Résolution de l’inférence/)).toBeDefined()
  })

  it('is left as it came when nobody translated it, rather than showing a key', () => {
    render(
      <DynamicForm
        fields={[field({ key: 'sampler', label: 'Sampler', help: 'Karras sigmas' })]}
        onSubmit={vi.fn()}
        submitLabel="Générer"
      />,
    )

    expect(screen.getByText('Sampler')).toBeDefined()
    expect(screen.getByText('Karras sigmas')).toBeDefined()
  })

  it('says the options of a choice in French too', () => {
    render(
      <DynamicForm
        fields={[
          field({
            key: 'ratio',
            kind: 'choice',
            label: 'Aspect ratio',
            required: true,
            options: [
              { value: 'square', label: 'Square' },
              { value: 'portrait', label: 'Portrait' },
            ],
          }),
        ]}
        onSubmit={vi.fn()}
        submitLabel="Générer"
      />,
    )

    expect(screen.getByText('Format')).toBeDefined()
    expect(screen.getByRole('option', { name: 'Carré' })).toBeDefined()
  })
})
