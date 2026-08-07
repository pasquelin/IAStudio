import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Project } from '@shared/domain/project'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collection-state'
import { useAssets } from '@/stores/assets'
import { useProject } from '@/stores/project'
import { AssetBrowser, AssetBrowserActions } from './AssetBrowser'

const PROJECT: Project = {
  path: '/tmp/project',
  manifest: { version: 1, name: 'Project', createdAt: '', updatedAt: '' },
}

function asset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    name: `Asset ${id}`,
    type: 'image',
    location: 'local',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/** Both halves, the way the tool window mounts them: the bar sits in the title row. */
function Panel() {
  return (
    <>
      <AssetBrowserActions />
      <AssetBrowser />
    </>
  )
}

describe('AssetBrowser', () => {
  beforeEach(() => {
    useAssets.setState({ items: [], collection: DEFAULT_COLLECTION_STATE })
    useProject.setState({ project: null })
  })

  // Two situations, and the user can only act on one of them.
  it('tells a project with no asset from no project at all', () => {
    const { rerender } = render(<Panel />)
    expect(screen.getByText(/Ouvrez un projet/)).toBeInTheDocument()

    useProject.setState({ project: PROJECT })
    rerender(<Panel />)
    expect(screen.getByText(/Aucun asset/)).toBeInTheDocument()
  })

  it('renders a window over the assets rather than all of them', () => {
    useAssets.setState({ items: Array.from({ length: 2000 }, (_, i) => asset(`a${i}`)) })
    render(<Panel />)

    const shown = screen.getAllByText(/^Asset a\d+$/)
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(300)
  })

  it('narrows the list as the search is typed', async () => {
    useAssets.setState({
      items: [asset('one', { name: 'Sunset' }), asset('two', { name: 'Robot' })],
    })
    render(<Panel />)

    await userEvent.type(screen.getByLabelText('Rechercher…'), 'sun')

    expect(screen.getByText('Sunset')).toBeInTheDocument()
    expect(screen.queryByText('Robot')).not.toBeInTheDocument()
  })

  it('distinguishes a filter that matched nothing from an empty project', async () => {
    useProject.setState({ project: PROJECT })
    useAssets.setState({ items: [asset('one', { name: 'Sunset' })] })
    render(<Panel />)

    await userEvent.type(screen.getByLabelText('Rechercher…'), 'zzz')

    expect(screen.getByText(/Aucun résultat pour ce filtre/)).toBeInTheDocument()
  })

  it('filters by asset type through the facet', async () => {
    useAssets.setState({
      items: [asset('img', { name: 'Sunset' }), asset('vid', { name: 'Clip', type: 'video' })],
    })
    render(<Panel />)

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'video')

    expect(screen.getByText('Clip')).toBeInTheDocument()
    expect(screen.queryByText('Sunset')).not.toBeInTheDocument()
  })
})
