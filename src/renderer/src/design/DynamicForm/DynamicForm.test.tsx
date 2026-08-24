import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import { insertAtCaret } from '@/dictation/insertAtCaret'
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

  describe('the accessory a caller hangs in a field', () => {
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

    it('sits in the long text box rather than under it', () => {
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

      const box = screen.getByLabelText(/Prompt/).parentElement
      expect(box?.contains(screen.getByRole('button', { name: 'Adopter' }))).toBe(true)
    })

    /**
     * What the whole arrangement rests on: dictation writes wherever the caret is, so a button
     * that took the focus left the spoken sentence with no field to land in — silently, since
     * the caret path answers `false` rather than guessing. A form carries three boxes at times,
     * and which one receives has to stay readable from the screen.
     */
    it('keeps the caret in the box its strip belongs to', async () => {
      render(
        <DynamicForm
          fields={fields}
          onSubmit={vi.fn()}
          submitLabel="Générer"
          accessory={shown =>
            shown.key === 'prompt' && (
              <button type="button" onClick={() => {}}>
                Dicter
              </button>
            )
          }
        />,
      )

      const box = screen.getByLabelText(/Prompt/)
      box.focus()
      await userEvent.click(screen.getByRole('button', { name: 'Dicter' }))

      expect(box).toHaveFocus()
    })

    // And gives it one it never had: a box spoken into without having been clicked in first.
    it('gives the box the caret when the strip is pressed', async () => {
      render(
        <DynamicForm
          fields={fields}
          onSubmit={vi.fn()}
          submitLabel="Générer"
          accessory={shown =>
            shown.key === 'prompt' && (
              <button type="button" onClick={() => {}}>
                Dicter
              </button>
            )
          }
        />,
      )

      await userEvent.click(screen.getByRole('button', { name: 'Dicter' }))

      expect(screen.getByLabelText(/Prompt/)).toHaveFocus()
    })

    /**
     * The OTHER way in, and it has to keep working: the held shortcut writes wherever the caret
     * is, in every field of the studio, and it reaches this one through the DOM rather than
     * through the form. Wrapping the box in a frame is exactly what could have broken it.
     */
    it('is not the only way in — the caret path still writes into the box', () => {
      render(<DynamicForm fields={fields} onSubmit={vi.fn()} submitLabel="Générer" />)

      const box = screen.getByLabelText(/Prompt/)
      box.focus()

      expect(insertAtCaret('un chat roux')).toBe(true)
      expect(box).toHaveValue('un chat roux')
    })

    // Silently, and that is the price of drawing it INSIDE the control: only a long text box
    // has a strip to put one in, and no other kind grew one for a caller that hangs on all.
    it('draws nothing on a field with no room for it', () => {
      render(
        <DynamicForm
          fields={fields}
          onSubmit={vi.fn()}
          submitLabel="Générer"
          accessory={shown => shown.key === 'steps' && <span>Sous les pas</span>}
        />,
      )

      expect(screen.queryByText('Sous les pas')).not.toBeInTheDocument()
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

describe('what survives a change of model', () => {
  // Labels a dictionary would translate are avoided on purpose: what is under test is the
  // carrying, and `Guidance` reads as « Guidage » in French.
  const SHARED: FieldDescriptor[] = [
    field({ key: 'prompt', label: 'Description', kind: 'longText' }),
    field({ key: 'alpha', label: 'Knob alpha', kind: 'integer', default: 20 }),
  ]
  const OTHER: FieldDescriptor[] = [
    field({ key: 'prompt', label: 'Description', kind: 'longText' }),
    field({ key: 'beta', label: 'Knob beta', kind: 'integer', default: 7 }),
  ]

  /**
   * § 22: a prompt written over several minutes went with the model it was typed under. What the
   * two models share is carried; what only the old one declared is dropped.
   */
  it('keeps what the new model also declares', async () => {
    const { rerender } = render(<DynamicForm fields={SHARED} onSubmit={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(/Description/), 'a stylised robot')

    rerender(<DynamicForm fields={OTHER} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/Description/)).toHaveValue('a stylised robot')
    expect(screen.queryByLabelText(/Knob alpha/)).toBeNull()
  })

  // A field the previous model left empty must take the new one's default rather than emptying
  // a knob nobody touched.
  it('lets the new model default a field the old one never had', async () => {
    const { rerender } = render(<DynamicForm fields={OTHER} onSubmit={vi.fn()} />)
    rerender(<DynamicForm fields={SHARED} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/Knob alpha/)).toHaveValue(20)
  })
})

describe('the advanced knobs', () => {
  const FIELDS: FieldDescriptor[] = [
    field({ key: 'prompt', label: 'Description', kind: 'longText' }),
    field({ key: 'seed', label: 'Knob gamma', kind: 'seed', group: 'advanced' }),
  ]

  /**
   * § 14: a panel that shows everything shows nothing. Seed, steps and guidance are not what most
   * generations are about, so they wait one click away rather than filling the column.
   */
  it('are folded away until they are asked for', () => {
    render(<DynamicForm fields={FIELDS} onSubmit={vi.fn()} submitLabel="Générer" />)

    expect(screen.getByRole('button', { name: /Avancé/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(/Knob gamma/)).not.toBeInTheDocument()
  })

  it('open on the heading that folds them', async () => {
    render(<DynamicForm fields={FIELDS} onSubmit={vi.fn()} submitLabel="Générer" />)

    await userEvent.click(screen.getByRole('button', { name: /Avancé/ }))

    expect(screen.getByLabelText(/Knob gamma/)).toBeVisible()
  })

  /**
   * 🛑 § 31 puts Generate ahead of what most people never touch, and ORDER stopped being enough:
   * a model declaring a dozen plain fields pushed the one button this form has out of sight.
   * Stuck to the foot of the scroller instead — jsdom has no layout, so the class is the witness.
   */
  it('keeps the button that runs the generation stuck to the foot', () => {
    render(<DynamicForm fields={FIELDS} onSubmit={vi.fn()} submitLabel="Générer" />)

    const foot = screen.getByRole('button', { name: 'Générer' }).parentElement

    expect(foot?.className).toContain('sticky')
    expect(foot?.className).toContain('bottom-0')
  })
})
