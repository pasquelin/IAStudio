import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Project } from '@shared/domain/project'
import { ToolZoneProvider } from '@/app/tool-zone'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collection-state'
import { useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { AssetBrowser } from './AssetBrowser'

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

describe('AssetBrowser', () => {
  beforeEach(() => {
    useAssets.setState({ items: [], collection: DEFAULT_COLLECTION_STATE })
    useProject.setState({ project: null })
    useMedia.setState({ progress: {}, capabilities: { ffmpeg: true } })
  })

  // Two situations, and the user can only act on one of them.
  it('tells a project with no asset from no project at all', () => {
    const { rerender } = render(<AssetBrowser />)
    expect(screen.getByText(/Ouvrez un projet/)).toBeInTheDocument()

    useProject.setState({ project: PROJECT })
    rerender(<AssetBrowser />)
    expect(screen.getByText(/Aucun asset/)).toBeInTheDocument()
  })

  it('renders a window over the assets rather than all of them', () => {
    useAssets.setState({ items: Array.from({ length: 2000 }, (_, i) => asset(`a${i}`)) })
    render(<AssetBrowser />)

    const shown = screen.getAllByText(/^Asset a\d+$/)
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(300)
  })

  it('narrows the list as the search is typed', async () => {
    useAssets.setState({
      items: [asset('one', { name: 'Sunset' }), asset('two', { name: 'Robot' })],
    })
    render(<AssetBrowser />)

    await userEvent.type(screen.getByLabelText('Rechercher…'), 'sun')

    expect(screen.getByText('Sunset')).toBeInTheDocument()
    expect(screen.queryByText('Robot')).not.toBeInTheDocument()
  })

  it('distinguishes a filter that matched nothing from an empty project', async () => {
    useProject.setState({ project: PROJECT })
    useAssets.setState({ items: [asset('one', { name: 'Sunset' })] })
    render(<AssetBrowser />)

    await userEvent.type(screen.getByLabelText('Rechercher…'), 'zzz')

    expect(screen.getByText(/Aucun résultat pour ce filtre/)).toBeInTheDocument()
  })

  it('names the asset type in the user language', () => {
    useAssets.setState({ items: [asset('vid', { name: 'Clip', type: 'video' })] })
    render(<AssetBrowser />)

    expect(screen.getByText('Vidéo')).toBeInTheDocument()
  })

  it('filters by asset type through the facet', async () => {
    useAssets.setState({
      items: [asset('img', { name: 'Sunset' }), asset('vid', { name: 'Clip', type: 'video' })],
    })
    render(<AssetBrowser />)

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'video')

    expect(screen.getByText('Clip')).toBeInTheDocument()
    expect(screen.queryByText('Sunset')).not.toBeInTheDocument()
  })

  it('shows what the ingest of an imported file is doing', () => {
    useAssets.setState({ items: [asset('vid', { name: 'A001', type: 'video' })] })
    useMedia.setState({
      progress: { vid: { assetId: 'vid', stage: 'proxy', ratio: 0.5 } },
    })
    render(<AssetBrowser />)

    // Named after the asset it prepares, not after its id: the row below says the same name.
    expect(screen.getByLabelText('A001 50%')).toBeInTheDocument()
    expect(screen.getByText('Proxy…')).toBeInTheDocument()
  })

  it('lets a failed import be dismissed, since nothing else ever clears it', async () => {
    const cancel = vi.fn(async () => undefined)
    useAssets.setState({ items: [asset('vid', { name: 'A001', type: 'video' })] })
    useMedia.setState({ progress: { vid: { assetId: 'vid', stage: 'failed', ratio: 1 } }, cancel })
    render(<AssetBrowser />)

    await userEvent.click(screen.getByRole('button', { name: /Retirer de la liste/ }))

    expect(cancel).toHaveBeenCalledWith('vid')
  })

  it('says what is unavailable rather than failing quietly when ffmpeg is missing', () => {
    useMedia.setState({
      capabilities: { ffmpeg: false },
      progress: { vid: { assetId: 'vid', stage: 'probe', ratio: 0.1 } },
    })
    render(<AssetBrowser />)

    expect(screen.getByText(/ffmpeg introuvable/)).toBeInTheDocument()
  })

  it('leaves the browser alone when nothing is being ingested', () => {
    render(<AssetBrowser />)
    expect(screen.queryByText(/ffmpeg introuvable/)).not.toBeInTheDocument()
  })

  // The bar follows the shape of the zone, not the workspace: no exception is coded for Video,
  // where the shelf stands in a column rather than lying across the band.
  describe('the filter bar', () => {
    // The bar's own container: a row of controls when laid out, a column of rows when stacked.
    function bar(): HTMLElement {
      const field = screen.getByRole('searchbox').closest('label')
      const container = field?.parentElement
      if (!container) throw new Error('filter bar not found')
      return container
    }

    it('lays its controls along a band', () => {
      render(
        <ToolZoneProvider zone="bottom">
          <AssetBrowser />
        </ToolZoneProvider>,
      )

      expect(bar().className).not.toContain('flex-col')
    })

    it('stacks them in a side column', () => {
      render(
        <ToolZoneProvider zone="left">
          <AssetBrowser />
        </ToolZoneProvider>,
      )

      expect(bar().className).toContain('flex-col')
    })
  })
})
