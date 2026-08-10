import { describe, expect, it, vi } from 'vitest'
import type { WorkflowEditorFlowItem } from '@scenario-labs/sdk'
import type { GraphState } from '@shared/domain/graph'
import { publishGraph, type WorkflowWriter } from './workflow-publish'

const graph: GraphState = {
  nodes: [
    {
      id: 'image2',
      type: 'asset',
      position: { x: 0, y: 0 },
      data: { isInput: true, type: 'image', title: 'Hero' },
    },
  ],
  edges: [],
  inputKeys: [],
}

const ABOUT = {
  name: 'Heroes',
  description: 'A roster',
  exportedAt: '2026-08-10T18:00:00.000Z',
  exportedBy: 'project_1',
}

const oneStep: readonly WorkflowEditorFlowItem[] = [{ id: 'm1', type: 'custom-model' }]

const writerOf = (overrides: Partial<WorkflowWriter> = {}): WorkflowWriter => ({
  create: () => Promise.resolve({ id: 'workflow_1' }),
  update: () => Promise.resolve(),
  ...overrides,
})

const deps = (writer: WorkflowWriter, flow = oneStep) => ({
  write: writer,
  flowOf: () => Promise.resolve(flow),
  report: vi.fn(),
})

describe('publishing a graph', () => {
  it('creates the workflow, then fills it and marks it ready', async () => {
    const create = vi.fn((_about: { name: string; description: string }) =>
      Promise.resolve({ id: 'workflow_7' }),
    )
    const update = vi.fn((_id: string, _body: unknown) => Promise.resolve())

    await expect(publishGraph(graph, ABOUT, deps(writerOf({ create, update })))).resolves.toEqual({
      ok: true,
      workflowId: 'workflow_7',
    })

    expect(create).toHaveBeenCalledWith({ name: 'Heroes', description: 'A roster' })
    expect(update).toHaveBeenCalledWith('workflow_7', {
      editorInfo: { nodes: graph.nodes, edges: [], inputKeys: [] },
      flow: oneStep,
      status: 'ready',
    })
  })

  /**
   * `create` takes a name and a description AND NOTHING ELSE — no nodes, no edges, no flow. The
   * chantier read the MCP tool's contract onto this one, which would have put a refusal on the
   * studio's side for a rule the REST API does not have.
   */
  it('sends nothing but a name and a description to the creation', async () => {
    const create = vi.fn((_about: { name: string; description: string }) =>
      Promise.resolve({ id: 'workflow_1' }),
    )

    await publishGraph(graph, ABOUT, deps(writerOf({ create })))

    expect(Object.keys(create.mock.calls[0]?.[0] ?? {}).sort()).toEqual(['description', 'name'])
  })

  /** A workflow marked ready with nothing in it is an App that answers nothing. */
  it('refuses an empty flow before it creates anything', async () => {
    const create = vi.fn(() => Promise.resolve({ id: 'workflow_1' }))

    await expect(publishGraph(graph, ABOUT, deps(writerOf({ create }), []))).resolves.toEqual({
      ok: false,
      problem: 'empty',
    })
    expect(create).not.toHaveBeenCalled()
  })

  /** The API's own sentence belongs to the journal; the screen gets the code. */
  it('answers refused and journals the reason when the API says no', async () => {
    const given = deps(writerOf({ create: () => Promise.reject(new Error('403 locked')) }))

    await expect(publishGraph(graph, ABOUT, given)).resolves.toEqual({
      ok: false,
      problem: 'refused',
    })
    expect(given.report).toHaveBeenCalledWith('403 locked')
  })

  /** A refusal on the second call leaves a draft behind, which is inert rather than broken. */
  it('answers refused when the filling is what fails', async () => {
    const given = deps(writerOf({ update: () => Promise.reject(new Error('409')) }))

    await expect(publishGraph(graph, ABOUT, given)).resolves.toMatchObject({
      ok: false,
      problem: 'refused',
    })
  })

  /** What makes a published workflow openable again — in the webapp, and back here. */
  it('writes the very editorInfo the exported file writes', async () => {
    const update = vi.fn((_id: string, _body: { editorInfo: Record<string, unknown> }) =>
      Promise.resolve(),
    )

    await publishGraph(graph, ABOUT, deps(writerOf({ update })))

    expect(update.mock.calls[0]?.[1].editorInfo).toEqual({
      nodes: graph.nodes,
      edges: [],
      inputKeys: [],
    })
  })
})
