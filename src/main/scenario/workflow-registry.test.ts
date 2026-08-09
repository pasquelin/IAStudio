import { describe, expect, it, vi } from 'vitest'
import {
  createWorkflowRegistry,
  type RemoteWorkflow,
  type WorkflowCatalog,
  type WorkflowListRequest,
} from './workflow-registry'

const APP: RemoteWorkflow = {
  id: 'workflow_1',
  name: 'Background remover',
  shortDescription: 'Cuts the subject out',
  description: 'The long one',
  status: 'ready',
  privacy: 'public',
  tagSet: ['tool', 'remove-background'],
  thumbnail: { url: 'https://cdn.example/after.png' },
  updatedAt: '2026-08-01T10:00:00.000Z',
}

function catalogOf(page: { workflows: readonly RemoteWorkflow[]; token: string | null }): {
  catalog: WorkflowCatalog
  requests: WorkflowListRequest[]
} {
  const requests: WorkflowListRequest[] = []
  const catalog: WorkflowCatalog = {
    list: request => {
      requests.push(request)
      return Promise.resolve(page)
    },
    retrieve: () => Promise.resolve({ workflow: APP }),
  }

  return { catalog, requests }
}

const noWatch = (): (() => void) => () => {}

const registryOn = (catalog: WorkflowCatalog) =>
  createWorkflowRegistry({ catalog: () => catalog, watch: noWatch })

describe('the workflow registry', () => {
  it('lists the public workflows — the Apps — unless asked otherwise', async () => {
    const { catalog, requests } = catalogOf({ workflows: [APP], token: null })

    const page = await registryOn(catalog).search({})

    expect(page.items).toHaveLength(1)
    expect(requests[0]).toMatchObject({ privacy: 'public' })
  })

  /**
   * The SDK types `shortDescription` as required, so an author who filled only the long one
   * sends an empty string — which `??` would hand through as the description.
   */
  it('prefers the short description, and falls back on an empty one as on an absent one', async () => {
    const { catalog } = catalogOf({ workflows: [APP], token: null })
    const bare = catalogOf({ workflows: [{ ...APP, shortDescription: undefined }], token: null })
    const blank = catalogOf({ workflows: [{ ...APP, shortDescription: '' }], token: null })

    await expect(registryOn(catalog).search({})).resolves.toMatchObject({
      items: [expect.objectContaining({ description: 'Cuts the subject out' })],
    })
    await expect(registryOn(bare.catalog).search({})).resolves.toMatchObject({
      items: [expect.objectContaining({ description: 'The long one' })],
    })
    await expect(registryOn(blank.catalog).search({})).resolves.toMatchObject({
      items: [expect.objectContaining({ description: 'The long one' })],
    })
  })

  it('shows the id of a workflow the API left unnamed', async () => {
    const { catalog } = catalogOf({ workflows: [{ id: 'workflow_9' }], token: null })

    await expect(registryOn(catalog).search({})).resolves.toMatchObject({
      items: [expect.objectContaining({ name: 'workflow_9' })],
    })
  })

  /**
   * The spelling of a ready listing could not be observed. Refusing what we do not recognise
   * would make every App inert the day Scenario writes `published`; only an explicit `draft`
   * blocks the button, and the API refuses what it must.
   */
  it('runs a workflow whose status it does not recognise, and refuses only an explicit draft', async () => {
    const unknown = catalogOf({ workflows: [{ ...APP, status: 'published' }], token: null })
    const absent = catalogOf({ workflows: [{ ...APP, status: undefined }], token: null })
    const draft = catalogOf({ workflows: [{ ...APP, status: 'draft' }], token: null })

    await expect(registryOn(unknown.catalog).search({})).resolves.toMatchObject({
      items: [expect.objectContaining({ status: 'ready', privacy: 'public' })],
    })
    await expect(registryOn(absent.catalog).search({})).resolves.toMatchObject({
      items: [expect.objectContaining({ status: 'ready' })],
    })
    await expect(registryOn(draft.catalog).search({})).resolves.toMatchObject({
      items: [expect.objectContaining({ status: 'draft' })],
    })
  })

  it('says nothing about a lock the API did not report', async () => {
    const { catalog } = catalogOf({ workflows: [APP, { ...APP, isLocked: true }], token: null })

    const [unlocked, locked] = (await registryOn(catalog).search({})).items

    expect(unlocked?.locked).toBeUndefined()
    expect(locked?.locked).toBe(true)
  })

  it('hands the API token back as its cursor, and closes on the last page', async () => {
    const more = catalogOf({ workflows: [APP], token: 'next' })
    const last = catalogOf({ workflows: [APP], token: null })

    await expect(registryOn(more.catalog).search({})).resolves.toMatchObject({ cursor: 'next' })
    await expect(registryOn(last.catalog).search({})).resolves.toMatchObject({ cursor: null })
  })

  it('resumes where the cursor said, and asks for the page size it was given', async () => {
    const { catalog, requests } = catalogOf({ workflows: [], token: null })

    await registryOn(catalog).search({ cursor: 'here', limit: 100 })

    expect(requests[0]).toMatchObject({ token: 'here', pageSize: 100 })
  })

  it('answers the same query from cache rather than asking again', async () => {
    const { catalog, requests } = catalogOf({ workflows: [APP], token: null })
    const registry = registryOn(catalog)

    await registry.search({})
    await registry.search({})

    expect(requests).toHaveLength(1)
  })

  it('forgets everything when the account changes', async () => {
    let invalidate = (): void => {}
    const { catalog, requests } = catalogOf({ workflows: [APP], token: null })
    const registry = createWorkflowRegistry({
      catalog: () => catalog,
      watch: callback => {
        invalidate = callback
        return () => {}
      },
    })

    await registry.search({})
    invalidate()
    await registry.search({})

    expect(requests).toHaveLength(2)
  })

  /** The very same translation a model's inputs go through — see invariant 5. */
  it('describes a workflow with the fields its inputs translate into', async () => {
    const retrieve = vi.fn(() =>
      Promise.resolve({
        workflow: {
          ...APP,
          inputs: [
            { name: 'image', type: 'file', kind: 'image', required: { always: true } },
            { name: 'strength', type: 'number', min: 0, max: 1, step: 0.1 },
          ],
        },
      }),
    )
    const registry = registryOn({
      list: () => Promise.resolve({ workflows: [], token: null }),
      retrieve,
    })

    const descriptor = await registry.describe('workflow_1')

    expect(descriptor.fields).toEqual([
      expect.objectContaining({ key: 'image', kind: 'image', required: true }),
      expect.objectContaining({ key: 'strength', kind: 'number', required: false }),
    ])

    await registry.describe('workflow_1')
    expect(retrieve).toHaveBeenCalledOnce()
  })
})
