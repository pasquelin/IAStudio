import type Scenario from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import { workflowCatalogOf } from './workflow-catalog'

vi.mock('@main/log', () => ({ log: { info: () => {}, warn: () => {}, error: () => {} } }))

const APP = { id: 'workflow_1', name: 'Background remover' }

/** Narrow on purpose: the catalogue touches one resource of the SDK's dozens. */
function client(page: { workflows: unknown[]; nextPaginationToken?: string }): {
  scenario: Scenario
  list: ReturnType<typeof vi.fn>
} {
  const list = vi.fn(() => Promise.resolve(page))
  const stub = { workflows: { list, retrieve: () => Promise.resolve({ workflow: APP }) } }

  return { scenario: stub as unknown as Scenario, list }
}

/** The write half: `create` then `update`, which is all the API offers — there is no `publish`. */
function writer(): {
  scenario: Scenario
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
} {
  const create = vi.fn(() => Promise.resolve({ workflow: { id: 'workflow_7' } }))
  const update = vi.fn(() => Promise.resolve({}))
  const stub = { workflows: { create, update } }

  return { scenario: stub as unknown as Scenario, create, update }
}

describe('the two writes a publication is', () => {
  it('creates with a name and a description, and answers the id', async () => {
    const { scenario, create } = writer()

    await expect(
      workflowCatalogOf(scenario).create({ name: 'Heroes', description: 'A roster' }),
    ).resolves.toEqual({ id: 'workflow_7' })
    expect(create).toHaveBeenCalledWith({ name: 'Heroes', description: 'A roster' })
  })

  /**
   * The SDK takes a mutable array, and reads it only — but what the caller holds must not be
   * handed free rein over, the same care `compileGraph` takes with the validator.
   */
  it('hands the flow over as a copy', async () => {
    const { scenario, update } = writer()
    const flow = [{ id: 'm1', type: 'custom-model' }]

    await workflowCatalogOf(scenario).update('workflow_7', {
      editorInfo: { nodes: [], edges: [], inputKeys: [] },
      flow,
      inputs: [],
      status: 'ready',
    })

    const sent = update.mock.calls[0]?.[1]
    expect(sent).toMatchObject({ status: 'ready' })
    expect(sent.flow).toEqual(flow)
    expect(sent.flow).not.toBe(flow)
  })
})

describe('the catalogue that binds the workflow registry to the SDK', () => {
  it('asks for the page the registry described', async () => {
    const { scenario, list } = client({ workflows: [APP], nextPaginationToken: 'next' })

    const page = await workflowCatalogOf(scenario).list({
      privacy: 'public',
      pageSize: 24,
      token: 'here',
    })

    expect(list).toHaveBeenCalledWith({
      privacy: 'public',
      pageSize: 24,
      paginationToken: 'here',
    })
    expect(page).toEqual({ workflows: [APP], token: 'next' })
  })

  it('leaves out what the request did not ask for', async () => {
    const { scenario, list } = client({ workflows: [] })

    await workflowCatalogOf(scenario).list({ privacy: 'private', pageSize: 24 })

    expect(list).toHaveBeenCalledWith({ privacy: 'private', pageSize: 24 })
  })

  /**
   * A short page is not the end — the API narrows server-side and still hands back a token —
   * but an empty one is. The rule is shared with the model and asset catalogues.
   */
  it('closes the listing on an empty page, not on a short one', async () => {
    const short = client({ workflows: [APP], nextPaginationToken: 'next' })
    const empty = client({ workflows: [], nextPaginationToken: 'next' })

    await expect(
      workflowCatalogOf(short.scenario).list({ privacy: 'public', pageSize: 24 }),
    ).resolves.toMatchObject({ token: 'next' })
    await expect(
      workflowCatalogOf(empty.scenario).list({ privacy: 'public', pageSize: 24 }),
    ).resolves.toMatchObject({ token: null })
  })

  it('retrieves one workflow by its id', async () => {
    const { scenario } = client({ workflows: [] })

    await expect(workflowCatalogOf(scenario).retrieve('workflow_1')).resolves.toEqual({
      workflow: APP,
    })
  })
})
