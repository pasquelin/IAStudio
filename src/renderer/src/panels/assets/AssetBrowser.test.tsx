import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import type { Project } from '@shared/domain/project'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collectionState'
import { useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { useSelection } from '@/stores/selection'
import { useSettings } from '@/stores/settings'
import { useCloud } from '@/stores/cloud'
import { useJobs } from '@/stores/jobs'
import { installFakeBridge } from '@/services/fakeBridge'
import { job } from '@/stores/job-fixtures'
import { withQueries } from '@/app/query-fixtures'
import { AssetBrowser } from './AssetBrowser'

/**
 * The shelf under a query client, which is what `Application.tsx` mounts around it: the library
 * and the public feed are both read a page at a time, and `useInfiniteQuery` is what holds their
 * cursors.
 */
const shelf = () => withQueries(<AssetBrowser />)

const openAsset = vi.fn()
vi.mock('@/helpers/openAsset', () => ({ openAsset: (...args: unknown[]) => openAsset(...args) }))

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
    // Said out loud, because the shelf narrows to the space's own kind: these fixtures are
    // pictures, and a block left in whichever space ran last would filter them all away.
    useLayouts.setState({ activeWorkspace: 'image' })
    useSelection.getState().clear()
    vi.clearAllMocks()
  })

  /**
   * Three situations behind one empty shelf, and each is acted on differently. "No project" is
   * asked first: with no folder open there is nothing for a filter to hide, and while the Type
   * facet had to be set by hand this branch was simply unreachable — it now carries the space's
   * own kind from the moment the panel opens.
   */
  it('tells a project with no asset of this kind from no project at all', async () => {
    const { rerender } = render(shelf())
    expect(screen.getByText(/Ouvrez un projet/)).toBeInTheDocument()

    useProject.setState({ project: PROJECT })
    rerender(shelf())

    // Awaited, because the shelf no longer answers « nothing here » while the library is still
    // being read: with a project open and nothing drawn, it says so rather than blaming the
    // project for an emptiness it cannot know yet.
    expect(await screen.findByText(/Aucun asset de ce type/)).toBeInTheDocument()
  })

  // And a narrowing the user asked for is blamed, where the space's own default is not: only
  // one of the two is cleared by touching the bar.
  it('blames the filter only when the user set one', async () => {
    useProject.setState({ project: PROJECT })
    useAssets.setState({ items: [asset('a')] })
    render(shelf())

    await userEvent.type(screen.getByLabelText(/Rechercher/i), 'nothing matches this')

    expect(await screen.findByText(/Aucun résultat|ne correspond/i)).toBeInTheDocument()
  })

  it('renders a window over the assets rather than all of them', () => {
    useAssets.setState({ items: Array.from({ length: 2000 }, (_, i) => asset(`a${i}`)) })
    render(shelf())

    const shown = screen.getAllByText(/^Asset a\d+$/)
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(300)
  })

  it('narrows the list as the search is typed', async () => {
    useAssets.setState({
      items: [asset('one', { name: 'Sunset' }), asset('two', { name: 'Robot' })],
    })
    render(shelf())

    await userEvent.type(screen.getByLabelText('Rechercher…'), 'sun')

    expect(screen.getByText('Sunset')).toBeInTheDocument()
    expect(screen.queryByText('Robot')).not.toBeInTheDocument()
  })

  it('distinguishes a filter that matched nothing from an empty project', async () => {
    useProject.setState({ project: PROJECT })
    useAssets.setState({ items: [asset('one', { name: 'Sunset' })] })
    render(shelf())

    await userEvent.type(screen.getByLabelText('Rechercher…'), 'zzz')

    expect(screen.getByText(/Aucun résultat pour ce filtre/)).toBeInTheDocument()
  })

  it('names the asset type in the user language', () => {
    useAssets.setState({ items: [asset('vid', { name: 'Clip', type: 'video' })] })
    render(shelf())

    expect(screen.getByText('Vidéo')).toBeInTheDocument()
  })

  it('filters by asset type through the facet', async () => {
    useAssets.setState({
      items: [asset('img', { name: 'Sunset' }), asset('vid', { name: 'Clip', type: 'video' })],
    })
    render(shelf())

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'video')

    expect(screen.getByText('Clip')).toBeInTheDocument()
    expect(screen.queryByText('Sunset')).not.toBeInTheDocument()
  })

  it('shows what the ingest of an imported file is doing', () => {
    useAssets.setState({ items: [asset('vid', { name: 'A001', type: 'video' })] })
    useMedia.setState({
      progress: { vid: { assetId: 'vid', stage: 'proxy', ratio: 0.5 } },
    })
    render(shelf())

    // Named after the asset it prepares, not after its id: the row below says the same name.
    expect(screen.getByLabelText('A001 50 %')).toBeInTheDocument()
    expect(screen.getByText('Proxy…')).toBeInTheDocument()
  })

  it('lets a failed import be dismissed, since nothing else ever clears it', async () => {
    const cancel = vi.fn(async () => undefined)
    useAssets.setState({ items: [asset('vid', { name: 'A001', type: 'video' })] })
    useMedia.setState({ progress: { vid: { assetId: 'vid', stage: 'failed', ratio: 1 } }, cancel })
    render(shelf())

    await userEvent.click(screen.getByRole('button', { name: /Retirer de la liste/ }))

    expect(cancel).toHaveBeenCalledWith('vid')
  })

  // The missing-ffmpeg notice moved to the title row — see `AssetBrowserActions`. Here it cost
  // the grid a row for the session, and a third one in a column, whose bar is already outside
  // the title row.
  it('gives the band to the ingests alone, the encoder notice having moved to the title row', () => {
    useMedia.setState({
      capabilities: { ffmpeg: false },
      progress: { vid: { assetId: 'vid', stage: 'probe', ratio: 0.1 } },
    })
    render(shelf())

    expect(screen.queryByText(/Préparation vidéo indisponible/)).not.toBeInTheDocument()
  })

  /**
   * One bar, under the title, in every space — the shelf stands in a column everywhere since
   * 17 August. It used to have two: the bar rode the title row while the shelf lay in a band,
   * and the branch that chose between them went with the placement.
   */
  it('stacks its filter bar under the title, where that row has no room', () => {
    render(shelf())

    const bar = screen.getByRole('searchbox').closest('label')?.parentElement
    expect(bar?.className).toContain('flex-col')
  })
})

describe('what the shelf shows of where an asset lives', () => {
  beforeEach(() => {
    useAssets.setState({ items: [], collection: DEFAULT_COLLECTION_STATE })
    useProject.setState({ project: PROJECT })
    useLayouts.setState({ activeWorkspace: 'image' })
    useSettings.setState({ auth: { authenticated: true, ownerId: 'proj_a' } })
  })

  // Two hundred identical marks are noise; the grid keeps them for what needs doing something
  // about, and the list, which has room, shows every state.
  it('leaves a settled asset unmarked in the grid', () => {
    useAssets.setState({ items: [asset('a', { name: 'Boulder' })] })
    render(shelf())

    expect(screen.queryByLabelText('Local seulement')).not.toBeInTheDocument()
  })

  it('marks it in the list, where there is room', () => {
    useAssets.setState({
      items: [asset('a', { name: 'Boulder' })],
      collection: { ...DEFAULT_COLLECTION_STATE, view: 'list' },
    })
    render(shelf())

    expect(screen.getByLabelText('Local seulement')).toBeInTheDocument()
  })

  it('marks an asset waiting to be sent', () => {
    useAssets.setState({
      items: [
        asset('a', {
          name: 'Boulder',
          remoteAssetId: 'remote_1',
          remoteOwnerId: 'proj_a',
          syncStatus: 'local-ahead',
        }),
      ],
    })
    render(shelf())

    expect(screen.getByLabelText(/à envoyer/)).toBeInTheDocument()
  })

  it('says when a twin belongs to a project this key does not open onto', () => {
    useAssets.setState({
      items: [
        asset('a', {
          name: 'Boulder',
          remoteAssetId: 'remote_1',
          remoteOwnerId: 'proj_other',
          syncStatus: 'synced',
        }),
      ],
    })
    render(shelf())

    expect(screen.getByLabelText('Appartient à un autre projet')).toBeInTheDocument()
  })
})

describe('the kinds a space has any use for', () => {
  beforeEach(() => {
    useProject.setState({ project: PROJECT })
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })
    useAssets.setState({
      items: [asset('a', { name: 'Boulder' })],
      collection: DEFAULT_COLLECTION_STATE,
      scope: null,
    })
  })

  // Asked OF the catalogue, so the header count and the empty message describe the same list.
  it('asks the catalogue only for what the space can use', () => {
    const setScope = vi.fn()
    useAssets.setState({ setScope })
    useLayouts.setState({ activeWorkspace: 'audio' })

    render(shelf())

    expect(setScope).toHaveBeenCalledWith(['audio'])
  })

  it('asks for pictures, materials and skies while painting', () => {
    const setScope = vi.fn()
    useAssets.setState({ setScope })
    useLayouts.setState({ activeWorkspace: 'image' })

    render(shelf())

    expect(setScope).toHaveBeenCalledWith(['image', 'texture', 'skybox'])
  })

  /**
   * The facet is the scope now, rather than something that cancelled it. Asking for takes while
   * painting used to switch the space's scope OFF and hand the catalogue `null` — the two read
   * as one broken filter. It asks for takes.
   */
  it('asks for exactly the kind the facet names', async () => {
    const setScope = vi.fn()
    useAssets.setState({ setScope })
    useLayouts.setState({ activeWorkspace: 'image' })
    render(shelf())
    setScope.mockClear()

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'audio')

    expect(setScope).toHaveBeenCalledWith(['audio'])
  })

  /**
   * What the user reported: nothing on screen said the shelf was narrowed, so a project that
   * plainly held meshes looked empty from Image and full of pictures from 3D. The bar carries
   * the answer now, and one click widens it.
   */
  it('writes the space’s own kind into the Type facet', () => {
    useLayouts.setState({ activeWorkspace: '3d' })

    render(shelf())

    expect(useAssets.getState().collection.selections.type).toEqual(['mesh'])
  })

  // Only when the space changes, never on the user's own choice: a filter that rewrote itself
  // under the hand that set it is one nobody can use.
  it('rewrites it when the space changes, and not under the user’s own choice', async () => {
    useLayouts.setState({ activeWorkspace: '3d' })
    render(shelf())

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'image')
    expect(useAssets.getState().collection.selections.type).toEqual(['image'])

    act(() => {
      useLayouts.setState({ activeWorkspace: 'audio' })
    })
    expect(useAssets.getState().collection.selections.type).toEqual(['audio'])
  })
})

/**
 * What belongs to the shelf is the wiring, not the gestures: `Collection` has its own tests for
 * the tab stop, the range and the two ways of activating a row.
 */
describe('the shelf hands its rows to the collection', () => {
  beforeEach(() => {
    useAssets.setState({ items: [], collection: DEFAULT_COLLECTION_STATE })
    useProject.setState({ project: PROJECT })
    useMedia.setState({ progress: {}, capabilities: { ffmpeg: true } })
    // Said out loud, because the shelf narrows to the space's own kind: these fixtures are
    // pictures, and a block left in whichever space ran last would filter them all away.
    useLayouts.setState({ activeWorkspace: 'image' })
    useSelection.getState().clear()
    vi.clearAllMocks()
  })

  it('selects the row a click lands on, and paints it', async () => {
    useAssets.setState({ items: [asset('one'), asset('two')] })
    render(shelf())

    // Scoped to the shelf: what it has picked is read out UNDER it (`AssetDetails`), so the name
    // of a picked row is on screen twice.
    const shown = (): HTMLElement => within(screen.getByRole('listbox')).getByText('Asset two')
    await userEvent.click(shown())

    expect(useSelection.getState().selection).toMatchObject({ kind: 'asset', ids: ['two'] })
    expect(shown().closest('[role="option"]')).toHaveAttribute('aria-selected', 'true')
  })

  // The shelf is the one panel whose actions are plural — sending and describing both take a
  // selection — and a modifier click used to replace it instead of adding to it.
  it('adds to the selection rather than replacing it, under the modifier', async () => {
    const user = userEvent.setup()
    useAssets.setState({ items: [asset('one'), asset('two'), asset('three')] })
    render(shelf())

    await user.click(screen.getByText('Asset one'))
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Asset three'))
    await user.keyboard('{/Meta}')

    expect(useSelection.getState().selection).toMatchObject({ ids: ['one', 'three'] })
  })

  it('opens an asset from the keyboard, which the shelf could not do at all', async () => {
    useAssets.setState({ items: [asset('one')] })
    render(shelf())

    await userEvent.click(screen.getByText('Asset one'))
    await userEvent.keyboard('{Enter}')

    expect(openAsset).toHaveBeenCalledWith(expect.objectContaining({ id: 'one' }))
  })

  it('still opens on a double-click, which is the gesture people know', async () => {
    useAssets.setState({ items: [asset('one')] })
    render(shelf())

    await userEvent.dblClick(screen.getByText('Asset one'))

    expect(openAsset).toHaveBeenCalledWith(expect.objectContaining({ id: 'one' }))
  })

  // The default state is the grid, so every test above draws cards. The shelf has two views and
  // the wiring belongs to neither: a row must answer the same as a card.
  it('hands its rows over in the list view too', async () => {
    useAssets.setState({
      items: [asset('one'), asset('two')],
      collection: { ...DEFAULT_COLLECTION_STATE, view: 'list' },
    })
    render(shelf())

    await userEvent.click(screen.getByText('Asset two'))
    expect(useSelection.getState().selection).toMatchObject({ kind: 'asset', ids: ['two'] })

    await userEvent.keyboard('{Enter}')
    expect(openAsset).toHaveBeenCalledWith(expect.objectContaining({ id: 'two' }))
  })
})

describe('the three provenances, as the panel draws them', () => {
  const cloudAsset: CloudAsset = {
    id: 'asset_remote',
    name: 'A library picture',
    type: 'image',
    remoteType: 'txt2img',
    ownerId: 'proj_1',
    createdAt: '2026-08-12T11:00:00.000Z',
    updatedAt: '2026-08-12T11:00:00.000Z',
    privacy: 'private',
    tags: [],
    collectionIds: [],
  }

  beforeEach(() => {
    useAssets.setState({ items: [], collection: DEFAULT_COLLECTION_STATE })
    useProject.setState({ project: PROJECT })
    useMedia.setState({ progress: {}, capabilities: { ffmpeg: true } })
    useJobs.setState({ jobs: [] })
    // Said out loud, because the shelf narrows to the space's own kind: these fixtures are
    // pictures, and a block left in whichever space ran last would filter them all away.
    useLayouts.setState({ activeWorkspace: 'image' })
    useCloud.getState().clear()
    useSelection.getState().clear()
    vi.clearAllMocks()
  })

  it('draws what the library holds beside what the project does', async () => {
    installFakeBridge({
      cloud: { browse: () => Promise.resolve({ assets: [cloudAsset], cursor: null }) },
    })
    useAssets.setState({ items: [asset('asset_1')] })

    render(shelf())

    expect(await screen.findByText('A library picture')).toBeInTheDocument()
    expect(screen.getByText('Asset asset_1')).toBeInTheDocument()
  })

  /**
   * The count belongs to the title row, which is another component and sees neither the library
   * page nor the filters — so the shelf publishes what it drew. It read the catalogue alone
   * before, and said "1 asset" over a list of two.
   */
  it('publishes how many lines it drew, and takes the number back on the way out', async () => {
    installFakeBridge({
      cloud: { browse: () => Promise.resolve({ assets: [cloudAsset], cursor: null }) },
    })
    useAssets.setState({ items: [asset('asset_1')] })

    const { unmount } = render(shelf())
    await screen.findByText('A library picture')

    expect(useAssets.getState().shownCount).toBe(2)

    unmount()
    expect(useAssets.getState().shownCount).toBeNull()
  })

  /**
   * The catalogue holds this project's rows and nothing else, so a word matched in memory could
   * only ever find what had already been pulled — the library was unsearchable from the shelf
   * that draws it.
   */
  it('sends what was typed to the library', async () => {
    const browse = vi.fn(() => Promise.resolve({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { browse } })

    render(shelf())
    await userEvent.type(screen.getByLabelText(/Rechercher/i), 'dragon')

    await vi.waitFor(() =>
      expect(browse).toHaveBeenCalledWith(expect.objectContaining({ text: 'dragon' })),
    )
  })

  it('sends it to the public feed too, once that facet asks for one', async () => {
    const explore = vi.fn(() => Promise.resolve({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { explore } })
    useAssets.setState({
      collection: { ...DEFAULT_COLLECTION_STATE, selections: { location: ['published'] } },
    })

    render(shelf())
    await userEvent.type(screen.getByLabelText(/Rechercher/i), 'dragon')

    await vi.waitFor(() =>
      expect(explore).toHaveBeenCalledWith(expect.objectContaining({ text: 'dragon' })),
    )
  })

  /**
   * The defect this closes: the index matches a prompt and a description as well as a name, so a
   * library hit found on its PROMPT was weighed again here against a name that never held the
   * word — and vanished from the very search that turned it up.
   */
  it('keeps a library row the API matched on something this side cannot see', async () => {
    installFakeBridge({
      cloud: { browse: () => Promise.resolve({ assets: [cloudAsset], cursor: null }) },
    })
    useAssets.setState({ items: [asset('asset_1')] })

    render(shelf())
    await screen.findByText('A library picture')
    await userEvent.type(screen.getByLabelText(/Rechercher/i), 'dragon')

    // The project's own row goes, judged on its name as it always was. The library's stays.
    await vi.waitFor(() => expect(screen.queryByText('Asset asset_1')).not.toBeInTheDocument())
    expect(screen.getByText('A library picture')).toBeInTheDocument()
  })

  /**
   * The main process narrows the API's page AFTER it lands, so a full library page holding
   * nothing of the kind on screen comes back empty with its cursor still alive. Read as « this
   * source could still hold anything newer », it hid the project's own catalogue behind it — and
   * an empty grid has no end for a scroll to reach, so nothing brought it back.
   */
  it('keeps drawing the project when the library answers a page of another kind', async () => {
    installFakeBridge({
      cloud: { browse: () => Promise.resolve({ assets: [], cursor: 't:page-2' }) },
    })
    useAssets.setState({ items: [asset('asset_1')] })

    render(shelf())

    expect(await screen.findByText('Asset asset_1')).toBeInTheDocument()
  })

  // The whole point of the merged list: the thing being made is on it before it exists.
  it('draws a generation that is still running', () => {
    installFakeBridge({})
    useJobs.setState({ jobs: [job({ label: 'A skeleton', status: 'running', progress: 0.4 })] })

    render(shelf())

    expect(screen.getByText('A skeleton')).toBeInTheDocument()
  })

  /**
   * Asked of the cells drawn rather than of the catalogue: a project holds hundreds of rows, and
   * checking every one at each refresh would be hundreds of syscalls on the process every window
   * shares. This is what checks the shelf asks at all, and only about what it lists.
   */
  it('asks the disk about the rows it is drawing, and marks what is gone', async () => {
    let asked: readonly string[] = []
    installFakeBridge({
      assets: {
        absent: ids => {
          asked = ids
          return Promise.resolve(['asset_gone'])
        },
      },
    })
    useAssets.setState({ items: [asset('asset_gone', { path: 'assets/img/gone.png' })] })

    render(shelf())

    await screen.findByTitle(/introuvable/i)
    expect(asked).toEqual(['asset_gone'])
  })

  /**
   * The recovery path, end to end through the panel: what is gone is the FILE, so the line goes
   * back to being the library one it can be fetched from — badge, gestures and all.
   */
  it('hands a lost row back to the library when a twin still answers for it', async () => {
    installFakeBridge({
      cloud: { browse: () => Promise.resolve({ assets: [cloudAsset], cursor: null }) },
      assets: { absent: () => Promise.resolve(['asset_gone']) },
    })
    useAssets.setState({
      items: [asset('asset_gone', { path: 'assets/img/gone.png', remoteAssetId: 'asset_remote' })],
    })

    render(shelf())

    // Its own name is gone with it: what stands there now is the library's line.
    expect(await screen.findByText('A library picture')).toBeInTheDocument()
    expect(screen.queryByText('Asset asset_gone')).toBeNull()
  })

  // A row that lost its file and has nothing to fetch it back from is tidied away: it points at
  // nothing, and no gesture on it could ever succeed.
  it('forgets a row of the project that lost its file for good', async () => {
    let removed: readonly string[] = []
    installFakeBridge({
      assets: {
        absent: () => Promise.resolve(['asset_gone']),
        remove: ids => {
          removed = ids
          return Promise.resolve()
        },
      },
    })
    useAssets.setState({ items: [asset('asset_gone', { path: 'assets/img/gone.png' })] })

    render(shelf())

    await vi.waitFor(() => expect(removed).toEqual(['asset_gone']))
  })

  /**
   * A LINKED medium has no `path` on this side of the boundary (`withoutSourcePath`), and its
   * absence usually means an unplugged volume rather than a deletion. Forgetting it would throw
   * away its tags and its provenance over a disk somebody will plug back in.
   */
  it('never forgets a linked medium whose volume may simply be unplugged', async () => {
    let removed = 0
    installFakeBridge({
      assets: {
        absent: () => Promise.resolve(['asset_rush']),
        remove: () => {
          removed += 1
          return Promise.resolve()
        },
      },
    })
    useAssets.setState({ items: [asset('asset_rush', { type: 'video' })] })
    useLayouts.setState({ activeWorkspace: 'video' })

    render(shelf())

    await screen.findByTitle(/introuvable/i)
    expect(removed).toBe(0)
  })
})

describe('what each gesture on a line does', () => {
  const cloudAsset: CloudAsset = {
    id: 'asset_remote',
    name: 'A library picture',
    type: 'image',
    remoteType: 'txt2img',
    ownerId: 'proj_1',
    createdAt: '2026-08-12T11:00:00.000Z',
    updatedAt: '2026-08-12T11:00:00.000Z',
    privacy: 'private',
    tags: [],
    collectionIds: [],
  }

  const pulled = asset('asset_pulled', { remoteAssetId: 'asset_remote' })

  beforeEach(() => {
    useAssets.setState({ items: [], collection: DEFAULT_COLLECTION_STATE })
    useProject.setState({ project: PROJECT })
    useMedia.setState({ progress: {}, capabilities: { ffmpeg: true } })
    useJobs.setState({ jobs: [] })
    // Said out loud, because the shelf narrows to the space's own kind: these fixtures are
    // pictures, and a block left in whichever space ran last would filter them all away.
    useLayouts.setState({ activeWorkspace: 'image' })
    useCloud.getState().clear()
    useSelection.getState().clear()
    vi.clearAllMocks()
  })

  it('opens a catalogue row on a double-click', async () => {
    installFakeBridge({})
    useAssets.setState({ items: [asset('asset_1')] })
    render(shelf())

    await userEvent.dblClick(screen.getByText('Asset asset_1'))

    expect(openAsset).toHaveBeenCalledWith(expect.objectContaining({ id: 'asset_1' }))
  })

  /**
   * One gesture, one meaning, whatever the line stands for. Stopping at the download left the
   * user having to guess that a second gesture was now needed, and which one.
   */
  it('fetches a library line first, then opens what arrived', async () => {
    installFakeBridge({
      cloud: {
        browse: () => Promise.resolve({ assets: [cloudAsset], cursor: null }),
        pull: () => {
          useAssets.setState({ items: [pulled] })
          return Promise.resolve([{ assetId: 'asset_remote', ok: true }])
        },
      },
      assets: { search: () => Promise.resolve([pulled]) },
    })
    render(shelf())

    await userEvent.dblClick(await screen.findByText('A library picture'))

    await vi.waitFor(() =>
      expect(openAsset).toHaveBeenCalledWith(expect.objectContaining({ id: 'asset_pulled' })),
    )
  })

  // One transfer at a time is the store's rule; the panel does not start a second one that
  // would be refused in silence.
  it('starts nothing on a library line while another transfer runs', async () => {
    let pulls = 0
    installFakeBridge({
      cloud: {
        browse: () => Promise.resolve({ assets: [cloudAsset], cursor: null }),
        pull: () => {
          pulls += 1
          return Promise.resolve([])
        },
      },
    })
    render(shelf())
    const tile = await screen.findByText('A library picture')

    useCloud.setState({ busy: true })
    await userEvent.dblClick(tile)

    expect(pulls).toBe(0)
  })

  /**
   * The selection store speaks catalogue ids, and a library line has none. Letting one in would
   * hand every action over it — push, describe, remove — a row that does not exist.
   */
  it('never selects a line the catalogue cannot answer for', async () => {
    installFakeBridge({
      cloud: { browse: () => Promise.resolve({ assets: [cloudAsset], cursor: null }) },
    })
    render(shelf())

    await userEvent.click(await screen.findByText('A library picture'))

    expect(useSelection.getState().selection).toMatchObject({ kind: 'none' })
  })

  /**
   * The loop a recovery opens: fetching a lost asset writes its file back under the row that
   * already existed, so without asking again the id would stay "absent" for ever and the
   * download would appear to have changed nothing.
   */
  it('asks again about what it believed lost once the catalogue moves', async () => {
    let asks = 0
    installFakeBridge({
      assets: {
        absent: () => {
          asks += 1
          return Promise.resolve(asks === 1 ? ['asset_gone'] : [])
        },
      },
    })
    useAssets.setState({ items: [asset('asset_gone', { path: 'assets/img/gone.png' })] })
    render(shelf())

    await screen.findByTitle(/introuvable/i)
    // A refresh of the catalogue is what re-opens the question.
    useAssets.setState({ items: [asset('asset_gone', { path: 'assets/img/gone.png' })] })

    await vi.waitFor(() => expect(asks).toBeGreaterThan(1))
  })

  // Filtering to nothing and holding nothing are different situations, and only one of them is
  // something the user can undo.
  it('tells an empty shelf from one narrowed to nothing', async () => {
    installFakeBridge({})
    useAssets.setState({
      items: [asset('asset_1')],
      collection: { ...DEFAULT_COLLECTION_STATE, search: 'nothing matches this' },
    })

    render(shelf())

    expect(await screen.findByText(/Aucun résultat|ne correspond/i)).toBeInTheDocument()
  })

  /**
   * The facet reaches the API, not just the rows already here. It used to switch the scope off
   * and pull a page of everything to sort out locally — sixty rows of which a handful could be
   * the kind asked for, on a shelf that pages no further.
   */
  it('asks the library for the kind the facet names', async () => {
    let asked: unknown
    installFakeBridge({
      cloud: {
        browse: query => {
          asked = query
          return Promise.resolve({ assets: [], cursor: null })
        },
      },
    })
    useAssets.setState({
      collection: { ...DEFAULT_COLLECTION_STATE, selections: { type: ['image'] } },
    })

    render(shelf())

    await vi.waitFor(() => expect(asked).toEqual({ pageSize: 60, types: ['image'] }))
  })

  /**
   * The public feed costs a SEARCH, and it is unbounded: read by default it would spend quota on
   * every mount and sit a thousand strangers' assets over a project's dozen. It is the one value
   * of the Location facet that changes what is read rather than what is drawn.
   */
  describe('what everyone else published', () => {
    it('is not read at all until the facet asks for it', async () => {
      let explored = 0
      installFakeBridge({
        cloud: {
          browse: () => Promise.resolve({ assets: [], cursor: null }),
          explore: () => {
            explored += 1
            return Promise.resolve({ assets: [], cursor: null })
          },
        },
      })

      render(shelf())
      await vi.waitFor(() => expect(screen.getByRole('searchbox')).toBeInTheDocument())

      expect(explored).toBe(0)
    })

    // One kind, because that is what the index can answer — and it is the kind on screen, which
    // the Type facet holds and which the space in front fills in.
    it('asks for the kind the shelf is showing, once the facet names it', async () => {
      let asked: unknown
      installFakeBridge({
        cloud: {
          browse: () => Promise.resolve({ assets: [], cursor: null }),
          explore: query => {
            asked = query
            return Promise.resolve({ assets: [], cursor: null })
          },
        },
      })
      useAssets.setState({
        collection: {
          ...DEFAULT_COLLECTION_STATE,
          selections: { type: ['image'], location: ['published'] },
        },
      })

      render(shelf())

      await vi.waitFor(() => expect(asked).toEqual({ type: 'image', pageSize: 60 }))
    })

    it('draws what it brought back, marked as somebody else’s', async () => {
      installFakeBridge({
        cloud: {
          browse: () => Promise.resolve({ assets: [], cursor: null }),
          explore: () =>
            Promise.resolve({
              assets: [{ ...cloudAsset, id: 'asset_theirs', name: 'Somebody else’s' }],
              cursor: null,
            }),
        },
      })
      useAssets.setState({
        collection: {
          ...DEFAULT_COLLECTION_STATE,
          selections: { type: ['image'], location: ['published'] },
        },
      })

      render(shelf())

      expect(await screen.findByText('Somebody else’s')).toBeInTheDocument()
    })
  })

  // A refusal opens nothing rather than guessing: an editor opened on a row that was never
  // written says less than nothing, and the journal already carries the why.
  it('opens nothing when the fetch behind a double-click failed', async () => {
    installFakeBridge({
      cloud: {
        browse: () => Promise.resolve({ assets: [cloudAsset], cursor: null }),
        pull: () => Promise.resolve([{ assetId: 'asset_remote', ok: false }]),
      },
      assets: { search: () => Promise.resolve([]) },
    })
    render(shelf())

    await userEvent.dblClick(await screen.findByText('A library picture'))

    await vi.waitFor(() => expect(useCloud.getState().busy).toBe(false))
    expect(openAsset).not.toHaveBeenCalled()
  })

  /**
   * A row whose twin can still bring it back is not an orphan: it is handed to the library as a
   * line one can fetch again, and forgetting it would throw away a recovery that is one click
   * away.
   */
  it('forgets no row that a twin could still bring back', async () => {
    let removed = 0
    installFakeBridge({
      cloud: { browse: () => Promise.resolve({ assets: [cloudAsset], cursor: null }) },
      assets: {
        absent: () => Promise.resolve(['asset_gone']),
        remove: () => {
          removed += 1
          return Promise.resolve()
        },
      },
    })
    useAssets.setState({
      items: [asset('asset_gone', { path: 'assets/img/gone.png', remoteAssetId: 'asset_remote' })],
    })

    render(shelf())

    await screen.findByText('A library picture')
    expect(removed).toBe(0)
  })

  // The other half of the loop: once the file is back, the row stops being marked and becomes
  // an ordinary line again — and it can be asked about afresh if it goes a second time.
  it('unmarks a row whose file has come back', async () => {
    let asks = 0
    installFakeBridge({
      assets: {
        absent: () => {
          asks += 1
          return Promise.resolve(asks === 1 ? ['asset_back'] : [])
        },
      },
    })
    const row = asset('asset_back', { path: 'assets/img/back.png' })
    useAssets.setState({ items: [row] })
    render(shelf())

    await screen.findByTitle(/introuvable/i)
    useAssets.setState({ items: [{ ...row }] })

    await vi.waitFor(() => expect(screen.queryByTitle(/introuvable/i)).toBeNull())
  })

  /**
   * The channel throws when no project is open — closing one while the shelf is scrolled is
   * enough. The ids must go back into the pool: `asked` is what stops a scroll from re-asking,
   * and leaving a failed batch in it would keep those rows unexaminable for the whole session.
   */
  it('asks again about a batch the main process refused', async () => {
    let attempts = 0
    installFakeBridge({
      assets: {
        absent: ids => {
          attempts += 1
          return attempts === 1
            ? Promise.reject(new Error('no project'))
            : Promise.resolve([...ids])
        },
      },
    })
    const row = asset('asset_1', { path: 'assets/img/one.png' })
    useAssets.setState({ items: [row] })
    render(shelf())

    await vi.waitFor(() => expect(attempts).toBe(1))
    // A refresh puts the same rows back on screen, and they are asked about afresh.
    useAssets.setState({ items: [{ ...row }] })

    await screen.findByTitle(/introuvable/i)
  })

  /**
   * A generation has no kind to answer with until it does, so its type column stays blank — the
   * honest answer rather than a guess at the shelf it will land in.
   *
   * And it is never hidden by one. Naming a kind used to hide it, which was defensible while
   * naming one was a deliberate act; the space in front now names one on arrival, so that rule
   * would have taken every generation in flight off the shelf built to show it.
   */
  it('keeps a running generation whatever kind is chosen, and never names its type', async () => {
    installFakeBridge({})
    useJobs.setState({ jobs: [job({ label: 'A skeleton', status: 'running', progress: 0.4 })] })
    useAssets.setState({ collection: { ...DEFAULT_COLLECTION_STATE, view: 'list' } })
    render(shelf())

    expect(screen.getByText('A skeleton')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'video')

    expect(screen.getByText('A skeleton')).toBeInTheDocument()
  })
})
