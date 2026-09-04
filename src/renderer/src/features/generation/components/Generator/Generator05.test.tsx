import { act, render, screen } from '@testing-library/react'

import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'

import { LOCAL_RUNTIME } from '@shared/domain/model'

import { aiRoleId } from '@shared/domain/aiRole'

import { useAiModels } from '@/stores/aiModels'

import userEvent from '@testing-library/user-event'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FieldDescriptor, ModelDescriptor } from '@shared/domain/model'

import type { Job } from '@shared/domain/job'

import { withQueries } from '@/features/shell/components/query-fixtures'

import { installFakeBridge } from '@/services/fakeBridge'

import { installCanvas } from '@/stores/canvas-fixtures'

import { useDocuments } from '@/stores/documents'

import { useLayouts } from '@/stores/layouts'

import { useGeneration } from '@/stores/generation'

import { job } from '@/stores/job-fixtures'

import { useJobs } from '@/stores/jobs'

import { useProject } from '@/stores/project'

import { DEFAULT_SETTINGS } from '@shared/domain/settings'

import { useSettings } from '@/stores/settings'

import { chooseModels } from '@/stores/models-fixtures'

import { Generator } from './Generator'

export const DOCUMENT = 'doc-1'

export const PICTURE: FieldDescriptor = {
  key: 'image',
  kind: 'image',
  label: 'Image',
  required: true,
}

export const DESCRIPTORS: Record<string, ModelDescriptor> = {
  model_flux: descriptor('model_flux', 'Flux', 'image'),
  model_big: descriptor('model_big', 'Magnific Upscaler', 'upscale'),
  'ssd-1b': {
    ...descriptor('ssd-1b', 'SSD-1B', 'image'),
    runsOn: LOCAL_RUNTIME,
  },
  model_code: {
    ...descriptor('model_code', 'Sonnet', 'code'),
    capabilities: ['txt2code', 'code2code'],
    fields: [{ key: 'prompt', kind: 'text', label: 'Prompt', required: true }],
  },
}

export function descriptor(
  id: string,
  name: string,
  family: ModelDescriptor['family'],
): ModelDescriptor {
  return {
    id,
    name,
    family,
    runsOn: SCENARIO_CLOUD,
    source: 'scenario',
    origin: 'official',
    featured: false,
    capabilities: ['img2img'],
    tags: [],
    fields: [PICTURE],
  }
}

export function renderPanel() {
  return render(withQueries(<Generator />))
}

export const PROJECT = {
  path: '/projects/demo',
  manifest: { version: 1, createdAt: '', updatedAt: '' },
}

describe('a generation in flight', () => {
  beforeEach(() => {
    installCanvas(DOCUMENT)
    useSettings.setState({
      auth: { authenticated: true },
      // A canvas is open here, so the question would stand in front of every case below. The two
      // that are ABOUT the question set `ask` themselves.
      settings: {
        ...DEFAULT_SETTINGS,
        generation: { ...DEFAULT_SETTINGS.generation, landing: 'document' },
      },
    })
    useAiModels.setState({ overview: null })
    useProject.setState({ project: PROJECT, known: true })
    useLayouts.setState({ activeWorkspace: 'image' })
    useGeneration.setState({ forcedCapability: aiRoleId('image', 'txt2img') })
    chooseModels({ [aiRoleId('image', 'txt2img')]: 'model_flux' })
    useJobs.setState({ jobs: [], bodies: {} })

    installFakeBridge({
      provider: {
        describeModel: (modelId: string) =>
          DESCRIPTORS[modelId]
            ? Promise.resolve(DESCRIPTORS[modelId])
            : Promise.reject(new Error('no model')),
        generate: () => Promise.resolve(job({ id: 'job_1', status: 'running', progress: 0.4 })),
      },
    })
  })

  /** The one required field of these descriptors, filled so the form will submit at all. */
  const generate = async (): Promise<void> => {
    await userEvent.type(await screen.findByLabelText(/Image/), 'asset-source')
    await userEvent.click(screen.getByRole('button', { name: /Générer/ }))
  }

  /**
   * 🛑 Asked BEFORE the run, never after: the answer decides where minutes of compute land, and
   * a question raised when the picture arrives is one nobody is still watching for.
   */
  it('asks where the result goes before spending anything on it', async () => {
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        generation: { ...DEFAULT_SETTINGS.generation, landing: 'ask' },
      },
    })
    renderPanel()

    await generate()

    expect(await screen.findByRole('dialog')).toBeVisible()
    expect(screen.queryByText('En cours')).toBeNull()
  })

  // With nothing open there is nothing to choose between, so nothing is asked.
  it('asks nothing when no document is waiting for the result', async () => {
    useDocuments.setState({ documents: {}, activeId: null })
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        generation: { ...DEFAULT_SETTINGS.generation, landing: 'ask' },
      },
    })
    renderPanel()

    await generate()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText('En cours')).toBeVisible()
  })

  /**
   * § 30: someone who pressed Generate watches the panel they pressed it in. A run whose only
   * trace is a bar at the foot of the window reads as a click that did nothing.
   */
  it('shows how far it has got, in the panel it was launched from', async () => {
    renderPanel()
    await generate()

    expect(await screen.findByText('En cours')).toBeVisible()
  })

  // 🛑 `submit` is a round trip, and a second press before it answers pays for two generations.
  it('disarms the button while one is running', async () => {
    renderPanel()
    await generate()

    expect(await screen.findByRole('button', { name: /Générer/ })).toBeDisabled()
  })

  /**
   * 🛑 The window the guard is FOR: while `submit` is in flight the job has no id yet, so
   * following the job list cannot answer for it. Reading `running` alone left the button live
   * for the whole round trip.
   */
  it('disarms it during the round trip, before any job id exists', async () => {
    let answer: (settled: Job) => void = () => {}
    installFakeBridge({
      provider: {
        describeModel: (modelId: string) =>
          DESCRIPTORS[modelId]
            ? Promise.resolve(DESCRIPTORS[modelId])
            : Promise.reject(new Error('no model')),
        generate: () => new Promise<Job>(resolve => (answer = resolve)),
      },
    })

    renderPanel()
    await generate()

    expect(screen.getByRole('button', { name: /Générer/ })).toBeDisabled()
    await act(async () => answer(job({ id: 'job_1', status: 'running' })))
  })

  it('offers to stop it, and asks the main process to', async () => {
    const cancel = vi.fn(() => Promise.resolve())
    useJobs.setState({ cancel })

    renderPanel()
    await generate()
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la tâche' }))

    expect(cancel).toHaveBeenCalledWith('job_1')
  })

  // A finished job has nothing to stop, and a button that cancels one answers nothing.
  it('takes the way to stop it away once it has finished', async () => {
    renderPanel()
    await generate()
    await screen.findByText('En cours')

    act(() => {
      useJobs.setState({ jobs: [job({ id: 'job_1', status: 'succeeded', progress: 1 })] })
    })

    expect(screen.queryByRole('button', { name: 'Annuler la tâche' })).toBeNull()
  })
})
