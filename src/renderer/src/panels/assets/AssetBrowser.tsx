import { mdiImageMultipleOutline } from '@mdi/js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, isAssetType, type AssetType } from '@shared/domain/asset'
import { typeOfWorkspace } from '@shared/domain/assetKind'
import { Collection } from '@/design/Collection/Collection'
import { CollectionBar } from '@/design/CollectionBar/CollectionBar'
import { EmptyState } from '@/design/EmptyState'
import { cloudPage } from '@/helpers/cloudPage'
import { filterLocally, isFiltered, setFacetValue } from '@/helpers/collectionState'
import { applySelection } from '@/helpers/selection'
import { openAsset } from '@/helpers/openAsset'
import { HINT_LEFT } from '@/helpers/tooltip'
import { assetTypesOf } from '@/helpers/workspaces'
import { useAssetFacets } from '@/hooks/useAssetFacets'
import { useAutomaticPulls } from '@/hooks/useAutomaticPulls'
import { useBadgeLabels } from '@/hooks/useBadgeLabels'
import { useDebounced, SEARCH_DELAY_MS } from '@/hooks/useDebounced'
import { usePages } from '@/hooks/usePages'
import { useTypeLabels } from '@/hooks/useTypeLabels'
import { getBridge } from '@/services/bridge'
import { renameAsset } from '@/helpers/rename'
import { assetsById, useAssets } from '@/stores/assets'
import { useCloud } from '@/stores/cloud'
import { useJobs } from '@/stores/jobs'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { selectedAssetIds, useSelection } from '@/stores/selection'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { AssetCard } from './AssetCard'
import { AssetRow } from './AssetRow'
import { ImportProgress } from './ImportProgress'
import { LOCATION_FACET, PUBLISHED_BADGE, TYPE_FACET } from './facets'
import { mergeFeed, type FeedSource, type FeedSourceName } from './feed'
import {
  markOf,
  mergeRows,
  nameOfRow,
  typeOfRow,
  type AssetRenameHandle,
  type AssetRowModel,
} from './rows'

/** How much of a cloud listing one page asks for. The scroll asks for the next. */
const LIBRARY_PAGE = 60

/** A stable empty set, so an untouched panel hands the same identity to every memo. */
const EMPTY_IDS: ReadonlySet<string> = new Set()

/**
 * Asset library, standing where an Unreal content browser would. Both views are virtualized
 * by `Collection`.
 *
 * It lists three provenances as one timeline — what the project holds, what the account's
 * library holds and has never been fetched, and what a job is still making. They are merged
 * rather than shown in three places because "the thing I just made" is one question, and
 * answering it should not require knowing which of the three produced it.
 *
 * The local half is filtered in memory: the whole project catalogue is already there. The
 * library half is asked of the API, narrowed to the kinds the space in front can take.
 */
export function AssetBrowser() {
  const { t } = useTranslation()
  const items = useAssets(state => state.items)
  const hasMore = useAssets(state => state.hasMore)
  const loadMore = useAssets(state => state.loadMore)
  const collection = useAssets(state => state.collection)
  const setCollection = useAssets(state => state.setCollection)
  const project = useProject(state => state.project)
  const workspace = useLayouts(state => state.activeWorkspace)
  const ownerId = useSettings(activeOwnerId)
  const typeLabels = useTypeLabels()
  const badgeLabels = useBadgeLabels()
  const facets = useAssetFacets(typeLabels)
  const setScope = useAssets(state => state.setScope)
  const setShownCount = useAssets(state => state.setShownCount)
  const selectedIds = useSelection(selectedAssetIds)
  const jobs = useJobs(state => state.jobs)
  const busy = useCloud(state => state.busy)
  const moving = useCloud(state => state.moving)

  /**
   * The kind the space in front MAKES, written into the Type facet whenever the space changes.
   *
   * A default that says its own name. The scope used to be invisible — the shelf narrowed to
   * everything a space can take, which is four kinds in 3D and all six in Video, and nothing on
   * screen said so: a mesh and a picture sat side by side under a bar claiming no filter at all.
   * Here the bar carries the answer, and one click widens it.
   *
   * On the space and never on the collection: this must not fight the user's own choice, only
   * replace it when they move to another space.
   */
  const ownType = typeOfWorkspace(workspace)
  useEffect(() => {
    if (ownType) setCollection(setFacetValue(useAssets.getState().collection, TYPE_FACET, ownType))
  }, [ownType, setCollection])

  /**
   * What the catalogue and the library are ASKED for — the facet's own answer, falling back to
   * everything this space can take when the facet is cleared.
   *
   * Asked OF them rather than filtered out of their answers: the count in the header and the
   * "this project has no asset" message both read the same list, and a shelf that dropped rows
   * behind their backs would leave them describing a project nobody is looking at.
   */
  const chosenTypes = collection.selections[TYPE_FACET]
  const scope = useMemo<readonly AssetType[]>(() => {
    const chosen = (chosenTypes ?? []).filter(isAssetType)
    return chosen.length > 0 ? chosen : assetTypesOf(workspace)
  }, [chosenTypes, workspace])
  useEffect(() => {
    setScope(scope)
  }, [setScope, scope])

  /**
   * What was typed, held back until the typing stops — and sent to the API from here on, which is
   * what makes the library searchable at all: matched in memory, a word could only ever find what
   * had already been pulled. The local half stays in memory, where the answer is instant.
   */
  const search = useDebounced(collection.search.trim(), SEARCH_DELAY_MS)

  // Keyed on the account, on what is asked for and on the word: another key is another library.
  const library = usePages(['assets', 'library', ownerId, scope, search], from =>
    getBridge()
      ?.cloud.browse({
        pageSize: LIBRARY_PAGE,
        types: scope,
        ...(search ? { text: search } : {}),
        ...from,
      })
      .then(cloudPage),
  )
  const remote = library.items

  /**
   * What everyone else published, read only while the Location facet asks for it — see
   * `PUBLISHED_BADGE`. It is the one value of that facet that changes what is READ.
   *
   * The kind is the scope's first, which is the Type facet's answer wherever one is chosen and
   * the space's own kind otherwise: the feed pages by one kind, and this is the one on screen.
   */
  const wantsPublished = (collection.selections[LOCATION_FACET] ?? []).includes(PUBLISHED_BADGE)
  const publishedType = wantsPublished ? (scope[0] ?? null) : null
  const feed = usePages(
    ['assets', 'published', publishedType, search],
    from =>
      publishedType === null
        ? undefined
        : getBridge()
            ?.cloud.explore({
              type: publishedType,
              pageSize: LIBRARY_PAGE,
              ...(search ? { text: search } : {}),
              ...from,
            })
            .then(cloudPage),
    // Never read while nobody asks for it: the feed is unbounded, and reading it costs a search.
    { enabled: publishedType !== null },
  )
  const published = feed.items

  /**
   * The rows whose file the disk no longer has.
   *
   * Asked of the cells actually drawn, as they are drawn: the catalogue holds hundreds of rows,
   * and `access` on every one of them at every refresh would be hundreds of syscalls on the
   * process every window shares (invariant 6). `asked` is what keeps a scroll from re-asking the
   * same question every few pixels.
   *
   * Deliberately not re-checked when the catalogue refreshes: a file deleted in the Finder while
   * this panel is open is not worth polling the disk for. Changing space or reopening the panel
   * asks again, which is when a stale answer would actually mislead.
   */
  const [absent, setAbsent] = useState<ReadonlySet<string>>(EMPTY_IDS)
  const [renaming, setRenaming] = useState<string | null>(null)
  // Resolved once here rather than per tile, for the reason `badgeLabels` and `hints` are: a
  // `useTranslation` inside a cell subscribes every one of two hundred of them.
  const renameLabel = t('assets.renameLabel')

  /**
   * What a row needs to be renamed, or nothing at all.
   *
   * Only a row the catalogue holds: a library asset has no row of this project's to name yet,
   * and a job still generating has no asset behind its tile.
   */
  const renameOf = (row: AssetRowModel): { rename: AssetRenameHandle } | null =>
    row.from === 'local'
      ? {
          rename: {
            open: renaming === row.asset.id,
            start: () => setRenaming(row.asset.id),
            label: renameLabel,
            commit: (name: string) => {
              setRenaming(null)
              renameAsset(row.asset.id, row.asset.name, name)
            },
          },
        }
      : null
  const asked = useRef<Set<string>>(new Set())

  const checkPresence = useCallback((visible: readonly AssetRowModel[]) => {
    const fresh = visible
      .filter(row => row.from === 'local' && !asked.current.has(row.id))
      .map(row => row.id)
    if (fresh.length === 0) return

    for (const id of fresh) asked.current.add(id)

    void getBridge()
      ?.assets.absent(fresh)
      .then(gone => {
        if (gone.length === 0) return
        setAbsent(held => new Set([...held, ...gone]))
        return forgetOrphans(gone)
      })
      .catch(() => {
        // The channel throws when no project is open — closing one while the shelf is scrolled
        // is enough. Asked again rather than written off: `asked` is what stops a scroll from
        // re-asking, and leaving these ids in it would keep them unexaminable for the session.
        for (const id of fresh) asked.current.delete(id)
      })
  }, [])

  /**
   * Asks again about the ones believed lost, whenever the catalogue changes.
   *
   * This is what closes the loop a recovery opens: fetching a lost asset writes its file back
   * under the row that already existed — `findByRemoteId` reuses it — so without this the id
   * would stay in `absent` for ever, the local line would stay hidden behind its twin, and a
   * download would appear to change nothing.
   *
   * Bounded by what is already believed absent, so it costs nothing on a project that has lost
   * nothing — which is every project, most of the time.
   */
  useEffect(() => {
    if (absent.size === 0) return

    const asking = [...absent]

    void getBridge()
      ?.assets.absent(asking)
      .then(gone => {
        const back = new Set(gone)
        const returned = asking.filter(id => !back.has(id))
        if (returned.length === 0) return

        for (const id of returned) asked.current.delete(id)
        // Only the ids this call asked about are dropped: replacing the whole set with `back`
        // would erase an absence `checkPresence` discovered while this was in flight.
        setAbsent(held => new Set([...held].filter(id => !returned.includes(id))))
      })
      // Same reason as above — a closed project makes the channel throw, and a rejection here
      // would leave rows marked lost with nothing left to clear them.
      .catch(() => {})
    // `absent` alone would loop: every answer sets it, and a set of the same ids is a new object.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [items])

  /**
   * The two tooltips a cell may carry, built once for the panel.
   *
   * Same reason as `badgeLabels`, and the same mistake it exists to prevent: a `useTranslation`
   * inside a cell subscribes each of two hundred of them to i18next and allocates a fresh
   * attribute object on every frame of a scroll.
   */
  const hints = useMemo(
    () => ({
      fetch: HINT_LEFT(t('assets.fetchHint')),
      generating: HINT_LEFT(t('assets.generatingHint')),
    }),
    [t],
  )

  // The library page keyed by its own ids, as `usePages` already holds it — a local row finds the
  // twin it records there.
  const twins = library.byId
  const rows = useMemo(
    () => mergeRows({ local: items, remote, published, jobs, scope, absent }),
    [items, remote, published, jobs, scope, absent],
  )

  /**
   * Each line WITH the mark it wears, resolved once for the panel.
   *
   * Carried on the row rather than looked up per cell: a map meant every reader had to answer
   * "and if it is missing?" three times over, for a key built from the very list it indexes. The
   * badge is a property of the line, so the line holds it.
   *
   * A local row's mark is `assetBadgeOf`'s answer unless the library page in hand says the twin
   * has moved since the last reconciliation — the only thing that makes `to-pull` and `conflict`
   * reachable at all, since nothing else ever compares the two stamps.
   */
  const marked = useMemo(() => {
    const inFlight = new Set(moving)

    return rows.map(row => ({ ...row, badge: markOf(row, { ownerId, twins, inFlight, absent }) }))
  }, [rows, ownerId, twins, moving, absent])

  // Rebuilt with the rows rather than per click: `onSelect` is handed every id in the range a
  // shift-click covers, and a set built inside it would be one walk of the list per gesture.
  const catalogued = useMemo(
    () => new Set(rows.filter(row => row.from === 'local').map(row => row.id)),
    [rows],
  )

  const filtered = useMemo(
    () =>
      filterLocally(marked, collection, {
        /**
         * The name for a line this project holds, and nothing for a library one: the index has
         * already matched those, on a prompt and a description this side cannot see. Judged again
         * here, a hit found on its PROMPT would vanish from the search that turned it up.
         */
        text: row => (row.from === 'remote' ? null : nameOfRow(row)),
        facets: {
          /**
           * A running generation holds no kind yet, so it holds them ALL: nothing about it says
           * it will not be the thing being looked for.
           *
           * It used to answer with none, which HID it as soon as a kind was named — defensible
           * while naming one was a deliberate act, and untenable now that the space in front
           * names one on arrival: every generation in flight would have gone missing from the
           * shelf that exists to show it. `mergeRows` had already made this call for the space's
           * own scope, in as many words.
           */
          [TYPE_FACET]: row => {
            const type = typeOfRow(row)
            return type ? [type] : ASSET_TYPES
          },
          // Narrowed by what the badge says, so the filter and the mark beside it agree.
          [LOCATION_FACET]: row => [row.badge],
        },
      }),
    [marked, collection],
  )

  /**
   * How far each source has been read — and only the ones that have ANSWERED, which is where this
   * panel departs from the rule `mergeFeed` states. Counted from the first render, the library
   * would hold the list back for as long as the API takes to reply, and an opening shelf would go
   * blank for a second where it now draws the project at once. What the cut protects is the
   * SCROLL, and there every source has long since answered.
   *
   * The feed is a source only while it is read: one nobody asks sits at « nothing read, not
   * finished » for ever.
   */
  // The stamps rather than the lists: a refresh hands back a fresh array of the same rows, and
  // depending on it would walk the whole timeline again on every generation that lands.
  const localReadTo = items.at(-1)?.createdAt
  const libraryReadTo = remote.at(-1)?.createdAt
  const publishedReadTo = published.at(-1)?.createdAt

  const sources = useMemo<Partial<Record<FeedSourceName, FeedSource>>>(
    () => ({
      local: { readTo: localReadTo, exhausted: !hasMore },
      ...(library.pending
        ? {}
        : { library: { readTo: libraryReadTo, exhausted: library.exhausted } }),
      ...(publishedType !== null && !feed.pending
        ? { published: { readTo: publishedReadTo, exhausted: feed.exhausted } }
        : {}),
    }),
    [
      localReadTo,
      hasMore,
      libraryReadTo,
      library.exhausted,
      library.pending,
      publishedReadTo,
      publishedType,
      feed.exhausted,
      feed.pending,
    ],
  )

  // Cut AFTER the filters: what is hidden has still been read, so the frontier is the same either
  // way, and cutting first would leave the tail of a filtered list unreachable.
  const { rows: shown, hungry } = useMemo(() => mergeFeed(filtered, sources), [filtered, sources])

  /**
   * Asks the source holding the list back, and only it — which one it is changes as the scroll
   * goes: the library runs out first on a project full of its own assets, the catalogue first on
   * one that has pulled nothing.
   */
  // Through its contents, because `mergeFeed` allocates a fresh list every render: handed to the
  // end-of-list effect as it comes, a keystroke would re-arm it and spend a page on each one.
  const asking = hungry.join(' ')
  // Named apart because `exhaustive-deps` reads `library.more` as a dependency on `library`, which
  // takes a fresh identity every render and would re-arm the effect below with it.
  const readMoreLibrary = library.more
  const readMoreFeed = feed.more
  const askForMore = useCallback(() => {
    const wanted = asking.split(' ')
    if (wanted.includes('local')) void loadMore()
    if (wanted.includes('library')) readMoreLibrary()
    if (wanted.includes('published')) readMoreFeed()
  }, [asking, loadMore, readMoreLibrary, readMoreFeed])

  // `ownerId` in the key: another account is another library, read from nothing — with the count
  // left where the previous one stopped, the shelf would sit empty with no scroll able to fill it.
  useAutomaticPulls({
    key: `${ownerId} ${search} ${scope.join()} ${publishedType}`,
    drawn: shown.length,
    fetching: library.fetching || feed.fetching,
    // Three sources, so the beat is all three: a page any of them answers with nothing moves no
    // row on screen, and the shelf would stop one pull in with pages still to come.
    answered: `${items.length} ${library.pagesRead} ${feed.pagesRead}`,
    // Nobody to ask is not a pull worth spending: no source is holding the list back.
    ask: asking === '' ? null : askForMore,
  })

  /**
   * The count in the title row says what this list holds, not what the catalogue does — the
   * header is a separate component and cannot see the library page or the filters from there.
   *
   * Cleared on the way out so a shelf that has closed stops answering for the next one.
   */
  const shownLength = shown.length
  useEffect(() => {
    setShownCount(shownLength)
  }, [setShownCount, shownLength])
  // Its own effect, so the number is not dropped and re-published on every change of the list.
  useEffect(() => () => setShownCount(null), [setShownCount])

  /**
   * Four situations, and the user can act on three of them.
   *
   * No project is asked FIRST, which it was not: with no folder open there is nothing for a
   * filter to hide, so blaming one is an answer about a shelf that does not exist. It never
   * showed while a filter had to be set by hand — the Type facet now carries the space's own
   * kind from the moment the panel opens.
   *
   * And that default has to be told from a narrowing the USER asked for, which is what
   * `isFiltered` alone cannot do: "nothing matches your filter" over a project full of pictures
   * sends someone hunting for a filter to clear, and clearing this one only widens to the four
   * kinds the space can take.
   */
  const atSpaceDefault = chosenTypes?.length === 1 && chosenTypes[0] === ownType
  const narrowedByHand = isFiltered(
    atSpaceDefault ? setFacetValue(collection, TYPE_FACET, null) : collection,
  )
  /**
   * And two more, between the first and the rest. A shelf with a project open and a source still
   * reading does not KNOW that it is empty; one whose library was refused knows even less — the
   * question was asked and nothing came back, so blaming the project for it is a lie with a
   * network behind it.
   */
  // Read off `sources` rather than asked again: a source that has not answered is not in the
  // record, and two spellings of that question would drift apart.
  const reading = !('library' in sources) || (publishedType !== null && !('published' in sources))
  const refused = library.refusal !== null || feed.refusal !== null
  const emptyMessage = !project
    ? t('assets.openProject')
    : reading
      ? t('collection.loading')
      : refused
        ? t('assets.libraryRefused')
        : narrowedByHand
          ? t('collection.noMatch')
          : atSpaceDefault
            ? t('assets.noneOfKind')
            : t('assets.none')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CollectionBar state={collection} onChange={setCollection} facets={facets} />
      <ImportProgress />
      <Collection
        label={t('panels.assets')}
        multiple
        items={shown}
        state={collection}
        // The shelf owns its rows' gestures rather than each row wiring its own: that is what
        // put these cells in the tab order, and what gives them the range a click could not ask
        // for. `DraggableAsset` keeps the drag and the menu, which belong to the row itself.
        selectedIds={selectedIds}
        // Only the lines a catalogue row answers for: the selection store speaks asset ids, and
        // the actions over it — push, describe, remove — all need a row that exists here.
        onSelect={(_row, ids, mode) => {
          const local = ids.filter(id => catalogued.has(id))
          useSelection.getState().selectAssets(applySelection(selectedIds, local, mode))
        }}
        // One gesture, one meaning, whatever the line stands for: opening it. A library line has
        // no bytes to open, so it is fetched FIRST and opened after — stopping at the download
        // left the user having to guess that a second gesture was now needed, and which one.
        onVisible={checkPresence}
        onReachEnd={askForMore}
        onActivate={row => {
          if (row.from === 'local') return void openAsset(row.asset)
          if (row.from === 'remote' && project && !busy) void openFetched(row.asset.id)
        }}
        renderCard={row => (
          <AssetCard
            row={row}
            badge={row.badge}
            badgeLabels={badgeLabels}
            typeLabels={typeLabels}
            hints={hints}
            {...(renameOf(row) ?? {})}
          />
        )}
        renderRow={row => (
          <AssetRow
            row={row}
            typeLabel={typeLabelOf(row, typeLabels)}
            badge={row.badge}
            badgeLabels={badgeLabels}
            hints={hints}
            {...(renameOf(row) ?? {})}
          />
        )}
        empty={
          <EmptyState
            icon={mdiImageMultipleOutline}
            message={emptyMessage}
            // The one emptiness with a way out: the others are answers, this one is a question
            // that came back unanswered.
            {...(refused
              ? {
                  action: {
                    label: t('actions.retry'),
                    hint: t('assets.libraryRefusedHint'),
                    onClick: () => {
                      library.retry()
                      feed.retry()
                    },
                  },
                }
              : {})}
          />
        }
      />
    </div>
  )
}

/**
 * Fetches a library asset, then opens what arrived — the double-click's whole errand.
 *
 * Opening nothing when the transfer failed is deliberate: `cloud:pull` has already written why
 * to the journal, and an editor opened on a row that was never created says less than nothing.
 */
async function openFetched(remoteAssetId: string): Promise<void> {
  const arrived = await useCloud.getState().fetchOne(remoteAssetId)
  if (arrived) await openAsset(arrived)
}

/**
 * Drops the rows that lost their file and can never get it back.
 *
 * Two conditions, and both are needed. The file has to have lived INSIDE the project — `path` is
 * set — because that is a file the studio wrote and the user deleted; a LINKED medium has no
 * `path` on this side of the boundary (`withoutSourcePath`), and its absence often means an
 * external volume is unplugged rather than gone. Marking one and waiting is right; forgetting it
 * would throw away its tags and its provenance over a disk somebody will plug back in.
 *
 * And it must have no twin: with one, the row is not dead but recoverable, and `mergeRows`
 * already hands it back to the library as a line one can fetch again.
 *
 * `alsoRemote: false` — nothing here may reach into the account's library. What is being tidied
 * is a row pointing at nothing, not an asset.
 */
async function forgetOrphans(absentIds: readonly string[]): Promise<void> {
  // Through the memoised index rather than a scan per id: it is keyed on the identity of
  // `items`, and five panels had walked the whole catalogue to find one row.
  const held = assetsById(useAssets.getState())
  const orphans = absentIds.filter(id => {
    const asset = held.get(id)
    return asset !== undefined && asset.path !== undefined && asset.remoteAssetId === undefined
  })
  if (orphans.length === 0) return

  try {
    await getBridge()?.assets.remove(orphans, false)
  } finally {
    // In a `finally`: a refusal still leaves the shelf drawing rows the main process may have
    // removed before it threw, and the caller runs this as a side errand it never awaits.
    useAssets.getState().invalidate()
  }
}

/** Blank for a job: it has no kind to name until it answers, and a guess would be one. */
function typeLabelOf(row: AssetRowModel, labels: Map<AssetType, string>): string {
  const type = typeOfRow(row)
  return type ? (labels.get(type) ?? type) : ''
}
