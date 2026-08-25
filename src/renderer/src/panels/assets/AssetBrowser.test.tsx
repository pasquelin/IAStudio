import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collectionState'
import { useAssets } from '@/stores/assets'
import { useLayouts } from '@/stores/layouts'
import { useLibraryPick } from '@/stores/libraryPick'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { useCloud } from '@/stores/cloud'
import { useJobs } from '@/stores/jobs'
import { installFakeBridge } from '@/services/fakeBridge'
import { job } from '@/stores/job-fixtures'
import { withQueries } from '@/app/query-fixtures'
import { AssetBrowser } from './AssetBrowser'

/**
 * The panel under a query client, which is what `Application.tsx` mounts around it: both
 * libraries are read a page at a time, and `useInfiniteQuery` is what holds their cursors.
 */
const shelf = () => withQueries(<AssetBrowser />)

const openAsset = vi.fn()
vi.mock('@/helpers/openAsset', () => ({ openAsset: (...args: unknown[]) => openAsset(...args) }))

const PROJECT = {
  path: '/tmp/project',
  manifest: { version: 1, name: 'Project', createdAt: '', updatedAt: '' },
}

function cloud(overrides: Partial<CloudAsset> = {}): CloudAsset {
  return {
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
    ...overrides,
  }
}

function local(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_pulled',
    name: 'Already here',
    type: 'image',
    location: 'local',
    tags: [],
    createdAt: '2026-08-12T11:00:00.000Z',
    // What `cloudBackend.pull` stamps on the way in. Without it the twin reads as one the
    // library has moved since — which is exactly what `reconciled` is there to answer.
    remoteSyncedAt: '2026-08-12T11:00:00.000Z',
    ...overrides,
  }
}

/** A library holding exactly this page, and a project holding nothing of it. */
const holding = (assets: readonly CloudAsset[] = [cloud()]) =>
  installFakeBridge({
    cloud: { browse: () => Promise.resolve({ assets: [...assets], cursor: null }) },
  })

beforeEach(() => {
  useAssets.setState({ items: [], collection: DEFAULT_COLLECTION_STATE })
  useProject.setState({ project: PROJECT })
  useJobs.setState({ jobs: [] })
  // Said out loud, because the panel narrows to the space's own kind: these fixtures are
  // pictures, and a block left in whichever space ran last would filter them all away.
  useLayouts.setState({ activeWorkspace: 'image' })
  // A working key is the ordinary state of this panel — and a CONDITION of it, see below.
  useSettings.setState({ auth: { authenticated: true, ownerId: 'proj_1' } })
  useCloud.getState().clear()
  useLibraryPick.setState({ picked: [] })
  vi.clearAllMocks()
})

describe('a remote browser with no key to open a library', () => {
  /**
   * 🛑 The panel used to list the project beside the library, so it had something to draw with
   * no account at all. It has not since 25 August: the placement now keeps its icon off the rail
   * entirely (`requires: 'cloud'`), and this is what stands behind that — a panel reached by a
   * stored layout says what is missing and how to fix it, rather than claiming an empty library.
   */
  it('says what is missing rather than drawing an empty library', () => {
    holding()
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })

    render(shelf())

    expect(screen.getByText(/identifiants API/i)).toBeInTheDocument()
  })

  /**
   * 🛑 The panel opened empty and stayed that way until it was closed and reopened. The channel
   * answers an EMPTY PAGE rather than refusing when no credentials resolve, so a listing asked
   * before the key was established came back as a finished, successful « this account owns
   * nothing » — and react-query had no reason to ask again.
   */
  it('does not read the library before a key is established, and reads it as soon as one is', async () => {
    const browse = vi.fn(() => Promise.resolve({ assets: [cloud()], cursor: null }))
    installFakeBridge({ cloud: { browse } })
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })

    const { rerender } = render(shelf())
    expect(browse).not.toHaveBeenCalled()

    useSettings.setState({ auth: { authenticated: true, ownerId: 'proj_1' } })
    rerender(shelf())

    expect(await screen.findByText('A library picture')).toBeInTheDocument()
  })
})

describe('what the remote browser draws', () => {
  it('draws what the account’s library holds', async () => {
    holding()

    render(shelf())

    expect(await screen.findByText('A library picture')).toBeInTheDocument()
  })

  /**
   * The count belongs to the title row, which is another component and sees neither the library
   * page nor the filters — so the panel publishes what it drew.
   */
  it('publishes how many lines it drew, and takes the number back on the way out', async () => {
    holding()

    const { unmount } = render(shelf())
    await screen.findByText('A library picture')

    expect(useAssets.getState().shownCount).toBe(1)

    unmount()
    expect(useAssets.getState().shownCount).toBeNull()
  })

  // The whole point of listing generations here: the thing being made is on the list before the
  // library holds it at all.
  it('draws a generation that is still running', () => {
    holding([])
    useJobs.setState({ jobs: [job({ label: 'A skeleton', status: 'running', progress: 0.4 })] })

    render(shelf())

    expect(screen.getByText('A skeleton')).toBeInTheDocument()
  })

  /**
   * What a store has to say about a line: whether spending a download on it would bring
   * anything. Asked OF the catalogue over the ids listed — see `useRemoteTwins`.
   */
  it('says which lines the project already holds, asking the catalogue about them', async () => {
    let asked: readonly string[] | undefined
    installFakeBridge({
      cloud: { browse: () => Promise.resolve({ assets: [cloud()], cursor: null }) },
      assets: {
        search: query => {
          asked = query.remoteAssetIds
          return Promise.resolve([local({ remoteAssetId: 'asset_remote' })])
        },
      },
    })

    render(shelf())

    await vi.waitFor(() => expect(asked).toEqual(['asset_remote']))
    expect(await screen.findByTitle(/Synchronisé/i)).toBeInTheDocument()
  })

  /**
   * The main process narrows the API's page AFTER it lands, so a full page holding nothing of
   * the kind on screen comes back empty with its cursor still alive. Read as « this source could
   * still hold anything newer », it hid every other line behind it.
   */
  it('keeps drawing what it has when a page comes back narrowed to nothing', async () => {
    installFakeBridge({
      cloud: { browse: () => Promise.resolve({ assets: [], cursor: 't:page-2' }) },
    })
    useJobs.setState({ jobs: [job({ label: 'A skeleton', status: 'running' })] })

    render(shelf())

    expect(await screen.findByText('A skeleton')).toBeInTheDocument()
  })
})

describe('what the browser asks the API for', () => {
  it('sends what was typed to the library rather than matching it here', async () => {
    const browse = vi.fn(() => Promise.resolve({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { browse } })

    render(shelf())
    await userEvent.type(screen.getByLabelText(/Rechercher/i), 'dragon')

    await vi.waitFor(() =>
      expect(browse).toHaveBeenCalledWith(expect.objectContaining({ text: 'dragon' })),
    )
  })

  /**
   * The index matches a prompt and a description as well as a name, so a hit found on its PROMPT
   * must not be weighed again here against a name that never held the word.
   */
  it('keeps a row the API matched on something this side cannot see', async () => {
    holding()

    render(shelf())
    await screen.findByText('A library picture')
    await userEvent.type(screen.getByLabelText(/Rechercher/i), 'dragon')

    expect(screen.getByText('A library picture')).toBeInTheDocument()
  })

  it('asks the library for exactly the kind the facet names', async () => {
    const browse = vi.fn(() => Promise.resolve({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { browse } })

    render(shelf())
    await userEvent.selectOptions(screen.getByLabelText(/Type/i), 'mesh')

    await vi.waitFor(() =>
      expect(browse).toHaveBeenCalledWith(expect.objectContaining({ types: ['mesh'] })),
    )
  })

  /**
   * The one facet that changes what is READ rather than what is drawn: the feed is unbounded and
   * a page of it costs a search quota, so it is asked for only while it is chosen.
   */
  it('reads the public feed only once the Origin facet asks for it', async () => {
    const explore = vi.fn(() => Promise.resolve({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { explore } })

    render(shelf())
    expect(explore).not.toHaveBeenCalled()

    await userEvent.selectOptions(screen.getByLabelText(/Origine/i), 'published')

    await vi.waitFor(() => expect(explore).toHaveBeenCalled())
  })

  /**
   * A default that says its own name: the scope used to be invisible — the panel narrowed to
   * everything a space can take, and nothing on screen said so.
   */
  it('writes the space’s own kind into the Type facet', () => {
    holding([])

    render(shelf())

    expect(useAssets.getState().collection.selections.type).toEqual(['image'])
  })

  // On the space and never on the collection: it must not fight the user's own choice, only
  // replace it when they move to another space.
  it('rewrites it when the space changes', () => {
    holding([])
    const { rerender } = render(shelf())

    useLayouts.setState({ activeWorkspace: 'audio' })
    rerender(shelf())

    expect(useAssets.getState().collection.selections.type).toEqual(['audio'])
  })
})

describe('what each gesture on a line does', () => {
  it('fetches a library line first, then opens what arrived', async () => {
    const arrived = local({ remoteAssetId: 'asset_remote' })
    installFakeBridge({
      cloud: {
        browse: () => Promise.resolve({ assets: [cloud()], cursor: null }),
        pull: () => Promise.resolve([{ assetId: arrived.id, ok: true }]),
      },
      assets: { search: () => Promise.resolve([arrived]) },
    })

    render(shelf())
    await userEvent.dblClick(await screen.findByText('A library picture'))

    await vi.waitFor(() => expect(openAsset).toHaveBeenCalledWith(arrived))
  })

  // One transfer at a time is `useCloud`'s own rule: a second gesture must not start a second.
  it('starts nothing while another transfer runs', async () => {
    const pull = vi.fn(() => Promise.resolve([]))
    installFakeBridge({
      cloud: { browse: () => Promise.resolve({ assets: [cloud()], cursor: null }), pull },
    })
    useCloud.setState({ busy: true })

    render(shelf())
    await userEvent.dblClick(await screen.findByText('A library picture'))

    expect(pull).not.toHaveBeenCalled()
  })

  /**
   * Picked in a store of its own rather than in the selection one: that store speaks catalogue
   * ids, and none of these lines has one until it is downloaded.
   */
  it('publishes what is picked, by the library’s own ids', async () => {
    holding()

    render(shelf())
    await userEvent.click(await screen.findByText('A library picture'))

    expect(useLibraryPick.getState().picked).toEqual(['remote:asset_remote'])
  })
})

describe('the four ways this panel can have nothing to draw', () => {
  it('says nothing is here rather than blaming a filter nobody set', async () => {
    holding([])

    render(shelf())

    expect(await screen.findByText(/Rien dans cette bibliothèque/)).toBeInTheDocument()
  })

  it('blames the filter once the user has set one', async () => {
    holding([])

    render(shelf())
    await userEvent.type(screen.getByLabelText(/Rechercher/i), 'nothing matches this')

    expect(await screen.findByText(/Aucun résultat|ne correspond/i)).toBeInTheDocument()
  })

  /**
   * A refusal and an end look alike on screen and must not be said alike: one is worth trying
   * again, the other is an answer.
   */
  it('offers to read again when the API refused, which an emptiness does not', async () => {
    installFakeBridge({ cloud: { browse: () => Promise.reject(new Error('429')) } })

    render(shelf())

    expect(await screen.findByRole('button', { name: /Réessayer/i })).toBeInTheDocument()
  })
})
