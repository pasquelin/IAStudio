import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraphNode, GraphState } from '@shared/domain/graph'
import type { FieldDescriptor, ModelDescriptor, ModelQuery } from '@shared/domain/model'
import { installFakeBridge } from '@/services/fake-bridge'
import { installGraph } from '@/stores/graph-fixtures'
import { graphOf, useGraphs } from '@/stores/graphs'
import { GraphNodeInspector } from './GraphNodeInspector'

const DOCUMENT = 'graph-1'

/**
 * Only two kinds of field become a port — the prompt the API marks, and every picture the model
 * takes. A plain text field stays in the form, which is what `modelPorts` reads.
 */
const fieldsOf = (...keys: string[]): FieldDescriptor[] =>
  keys.map(key =>
    key === 'prompt'
      ? { key, kind: 'longText', label: key, required: false, promptSpark: true }
      : { key, kind: 'image', label: key, required: false },
  )

const descriptor = (id: string, keys: string[]): ModelDescriptor => ({
  id,
  name: id === 'model_flux' ? 'Flux' : 'SDXL',
  family: 'image',
  source: 'scenario',
  origin: 'official',
  featured: false,
  capabilities: [],
  tags: [],
  fields: fieldsOf(...keys),
})

/** The generator, wired on the very port the second model does not declare. */
const generator: GraphNode = {
  id: 'imageGenerator1',
  type: 'model',
  position: { x: 0, y: 0 },
  data: {
    modelId: 'model_flux',
    type: 'image',
    form: { prompt: 'a rock' },
    inputHandles: [
      { id: 'imageGenerator1-source-prompt', name: 'prompt', type: 'prompt' },
      { id: 'imageGenerator1-source-mask', name: 'mask', type: 'image' },
    ],
    outputHandles: [{ id: 'imageGenerator1-target-image', name: 'output', type: 'image' }],
  },
}

const source: GraphNode = {
  id: 'asset1',
  type: 'asset',
  position: { x: 0, y: 0 },
  data: {
    type: 'image',
    outputHandles: [{ id: 'asset1-target-image', name: 'output', type: 'image' }],
  },
}

const WIRED: GraphState = {
  nodes: [generator, source],
  edges: [
    {
      id: 'mask-edge',
      source: 'imageGenerator1',
      sourceHandle: 'imageGenerator1-source-mask',
      target: 'asset1',
      targetHandle: 'asset1-target-image',
    },
  ],
  inputKeys: [],
}

const state = (): GraphState => graphOf(useGraphs.getState(), DOCUMENT)
const nodeNow = (): GraphNode | undefined => state().nodes.find(node => node.id === generator.id)

/** What the picker asked the catalogue — the fake used to ignore its argument entirely. */
let asked: (ModelQuery | undefined)[] = []

beforeEach(() => {
  asked = []
  installGraph(DOCUMENT, WIRED)
  installFakeBridge({
    scenario: {
      // The second model declares no `mask`: swapping to it must take the edge that fed one.
      describeModel: (id: string) =>
        Promise.resolve(
          id === 'model_flux' ? descriptor(id, ['prompt', 'mask']) : descriptor(id, ['prompt']),
        ),
      searchModels: (query?: ModelQuery) => {
        asked.push(query)
        return Promise.resolve({
          items: [descriptor('model_flux', []), descriptor('model_sdxl', [])],
          cursor: null,
        })
      },
    },
  })
})

/** Subscribed as `Inspector` is, and given the query client the panels run under. */
function show(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  function Live() {
    const node = useGraphs(inner =>
      graphOf(inner, DOCUMENT).nodes.find(entry => entry.id === generator.id),
    )
    return node ? <GraphNodeInspector documentId={DOCUMENT} node={node} /> : null
  }

  render(
    <QueryClientProvider client={client}>
      <Live />
    </QueryClientProvider>,
  )
}

describe('a generator node in the inspector', () => {
  /**
   * Narrowed on the family, and only ONCE the schema has named it. Asked before, the catalogue
   * answered with every family — and a model of another family chosen in that window renames the
   * output port, which cuts every edge reading this node without a word.
   */
  it('asks the catalogue for the family of the model the node runs, and only then', async () => {
    show()

    expect(await screen.findByRole('option', { name: 'SDXL' })).toBeInTheDocument()
    expect(asked).toEqual([{ limit: 60, family: 'image' }])
    expect(screen.getByLabelText('Modèle')).toHaveValue('model_flux')
  })

  it('renders the parameters the model publishes, never a form of its own', async () => {
    show()

    expect(await screen.findByText('prompt')).toBeInTheDocument()
  })

  /**
   * The ports come from the model's own schema (invariant 5), so swapping the model swaps them —
   * and this is the half nothing did before: an edge aimed at a port that is gone names a handle
   * no node carries, which `validateWorkflowFlow` rejects at export, far from the gesture.
   */
  it('cuts the edge whose port the new model does not declare', async () => {
    show()
    await screen.findByRole('option', { name: 'SDXL' })

    await userEvent.selectOptions(screen.getByLabelText('Modèle'), 'model_sdxl')

    await waitFor(() => expect(nodeNow()?.data).toMatchObject({ modelId: 'model_sdxl' }))
    expect(state().edges).toEqual([])
  })

  it('rebuilds the ports from the new model rather than keeping the old ones', async () => {
    show()
    await screen.findByRole('option', { name: 'SDXL' })

    await userEvent.selectOptions(screen.getByLabelText('Modèle'), 'model_sdxl')

    await waitFor(() =>
      expect(nodeNow()?.data.inputHandles?.map(handle => handle.name)).toEqual([
        'conditional',
        'prompt',
      ]),
    )
  })

  /** One ⌘Z gives back the model AND the ports AND the edge — they are one command. */
  it('undoes a model swap whole', async () => {
    show()
    await screen.findByRole('option', { name: 'SDXL' })
    await userEvent.selectOptions(screen.getByLabelText('Modèle'), 'model_sdxl')
    await waitFor(() => expect(nodeNow()?.data).toMatchObject({ modelId: 'model_sdxl' }))

    useGraphs.getState().undo(DOCUMENT)

    expect(nodeNow()?.data).toMatchObject({ modelId: 'model_flux' })
    expect(state().edges).toHaveLength(1)
  })

  /** Opening a panel is not an edit: the form reports its body once at mount, and that is not one. */
  it('writes nothing to the history for a panel merely opened', async () => {
    show()
    await screen.findByText('prompt')

    expect(useGraphs.getState().histories[DOCUMENT]?.past ?? []).toEqual([])
  })

  /**
   * A prompt written into one model is a prompt: `defaultValues` takes a preset for exactly this,
   * and dropping it made trying another model cost forty words without warning.
   */
  it('keeps what was typed under every key the new model still declares', async () => {
    show()
    await screen.findByRole('option', { name: 'SDXL' })

    await userEvent.selectOptions(screen.getByLabelText('Modèle'), 'model_sdxl')

    // `model_sdxl` declares `prompt` and not `mask`: the prompt survives, the rest goes with the
    // model that declared it. Dropping the preset cost forty words without warning.
    await waitFor(() => expect(nodeNow()?.data).toMatchObject({ modelId: 'model_sdxl' }))
    expect(nodeNow()?.data).toMatchObject({ form: { prompt: 'a rock' } })
  })

  /** A whole typed sentence is ONE entry, as it is in every other field of this panel. */
  it('collapses a typed parameter into a single history entry', async () => {
    show()
    const prompt = await screen.findByLabelText(/prompt/i)

    await userEvent.type(prompt, 'ette')

    expect(useGraphs.getState().histories[DOCUMENT]?.past ?? []).toHaveLength(1)
  })

  /** Offline, the select springs back on its own; without this nothing anywhere says why. */
  it('reports a model that could not be described', async () => {
    const report = vi.fn(() => Promise.resolve())
    installFakeBridge({
      diagnostics: { report },
      scenario: {
        describeModel: (id: string) =>
          id === 'model_flux'
            ? Promise.resolve(descriptor(id, ['prompt']))
            : Promise.reject(new Error('offline')),
        searchModels: () =>
          Promise.resolve({ items: [descriptor('model_sdxl', [])], cursor: null }),
      },
    })
    show()
    await screen.findByRole('option', { name: 'SDXL' })

    await userEvent.selectOptions(screen.getByLabelText('Modèle'), 'model_sdxl')

    await waitFor(() => expect(report).toHaveBeenCalled())
    // The node keeps the model it was running: a failed swap must not half-apply.
    expect(nodeNow()?.data).toMatchObject({ modelId: 'model_flux' })
  })

  it('keeps the model the node runs on offer even when the page does not list it', async () => {
    installFakeBridge({
      scenario: {
        describeModel: () => Promise.resolve(descriptor('model_flux', ['prompt'])),
        searchModels: () =>
          Promise.resolve({ items: [descriptor('model_sdxl', [])], cursor: null }),
      },
    })
    show()

    expect(await screen.findByRole('option', { name: 'Flux' })).toBeInTheDocument()
  })
})
