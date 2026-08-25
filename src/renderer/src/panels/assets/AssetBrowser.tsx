import { mdiImageMultipleOutline } from '@mdi/js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, isAssetType, isCloudAssetType, type AssetType } from '@shared/domain/asset'
import { typeOfWorkspace } from '@shared/domain/assetKind'
import { Collection } from '@/design/Collection/Collection'
import { CollectionBar } from '@/design/CollectionBar/CollectionBar'
import { EmptyState } from '@/design/EmptyState'
import { cloudPage } from '@/helpers/cloudPage'
import { filterLocally, isFiltered, setFacetValue } from '@/helpers/collectionState'
import { applySelection } from '@/helpers/selection'
import { HINT_LEFT } from '@/helpers/tooltip'
import { assetTypesOf } from '@/helpers/workspaces'
import { useAssetFacets } from '@/hooks/useAssetFacets'
import { useAutomaticPulls } from '@/hooks/useAutomaticPulls'
import { useBadgeLabels } from '@/hooks/useBadgeLabels'
import { useDebounced, SEARCH_DELAY_MS } from '@/hooks/useDebounced'
import { usePages } from '@/hooks/usePages'
import { useRemoteTwins } from '@/hooks/useRemoteTwins'
import { useTypeLabels } from '@/hooks/useTypeLabels'
import { getBridge } from '@/services/bridge'
import { openAsset } from '@/helpers/openAsset'
import { useAssets } from '@/stores/assets'
import { useCloud } from '@/stores/cloud'
import { useJobs } from '@/stores/jobs'
import { useLibraryPick } from '@/stores/libraryPick'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { MissingCredentials } from '@/panels/shared/MissingCredentials'
import { AssetCard } from './AssetCard'
import { AssetDetails } from './AssetDetails'
import { AssetRow } from './AssetRow'
import { OWN_SOURCE, PUBLISHED_SOURCE, SOURCE_FACET, TYPE_FACET } from './facets'
import { mergeFeed, type FeedSource, type FeedSourceName } from './feed'
import { markOf, mergeRows, typeOfRow, type AssetRowModel } from './rows'

/** How much of a cloud listing one page asks for. The scroll asks for the next. */
const LIBRARY_PAGE = 60

/** A stable empty selection, so an untouched panel hands the same identity to every memo. */
const NOTHING: readonly string[] = []

/** What a line of the account's own library answers the Source facet with. */
const SOURCES_OF_OWN: readonly string[] = [OWN_SOURCE]

/**
 * The account's remote library, standing where an Unreal content browser would. Both views are
 * virtualized by `Collection`.
 *
 * 🛑 It lists what is NOT on this machine, and only that: the account's own cloud library, what
 * everyone else published, and the generations still being made. What the project holds is the
 * Explorer's subject — two panels answering the same question with different words is what this
 * panel used to be, and the catalogue half of it left on 25 August.
 *
 * The two remote halves are one timeline rather than two lists: someone looking for "the thing I
 * just made" should not have to know which of them produced it. Both are asked OF the API,
 * narrowed to the kinds the space in front can take — the index matches on a prompt and a
 * description this side never sees, which is what makes them searchable at all.
 */
export function AssetBrowser() {
  const { t } = useTranslation()
  const collection = useAssets(state => state.collection)
  const setCollection = useAssets(state => state.setCollection)
  const project = useProject(state => state.project)
  const workspace = useLayouts(state => state.activeWorkspace)
  const ownerId = useSettings(activeOwnerId)
  // The key is known to WORK, not merely to be stored: `authState` resolves the credentials the
  // channels below need, so this is the earliest moment a listing can come back with anything.
  const authenticated = useSettings(state => state.auth.authenticated)
  const typeLabels = useTypeLabels()
  const badgeLabels = useBadgeLabels()
  const facets = useAssetFacets(typeLabels)
  const setShownCount = useAssets(state => state.setShownCount)
  const jobs = useJobs(state => state.jobs)
  const busy = useCloud(state => state.busy)
  const moving = useCloud(state => state.moving)
  /**
   * The kind the space in front MAKES, written into the Type facet whenever the space changes.
   *
   * A default that says its own name. The scope used to be invisible — the shelf narrowed to
   * everything a space can take, which is four kinds in 3D and all six in Video, and nothing on
   * screen said so. Here the bar carries the answer, and one click widens it.
   *
   * On the space and never on the collection: this must not fight the user's own choice, only
   * replace it when they move to another space.
   */
  const ownType = typeOfWorkspace(workspace)
  useEffect(() => {
    if (ownType) setCollection(setFacetValue(useAssets.getState().collection, TYPE_FACET, ownType))
  }, [ownType, setCollection])

  /**
   * What the libraries are ASKED for — the facet's own answer, falling back to everything this
   * space can take when the facet is cleared.
   */
  const chosenTypes = collection.selections[TYPE_FACET]
  const scope = useMemo<readonly AssetType[]>(() => {
    const chosen = (chosenTypes ?? []).filter(isAssetType)
    return chosen.length > 0 ? chosen : assetTypesOf(workspace)
  }, [chosenTypes, workspace])

  /** What was typed, held back until the typing stops, and sent to the API from here on. */
  const search = useDebounced(collection.search.trim(), SEARCH_DELAY_MS)

  /**
   * The same scope, minus what the API has never heard of: there is no animation class over
   * there, and asking for one would answer a page of characters.
   */
  const cloudScope = useMemo(() => scope.filter(isCloudAssetType), [scope])

  /**
   * Which libraries are being read. Nothing chosen reads the account's own, which is what
   * someone opening the panel is looking for; the feed is ADDED to it rather than replacing it.
   */
  const chosenSources = collection.selections[SOURCE_FACET]
  const wantsPublished = (chosenSources ?? []).includes(PUBLISHED_SOURCE)
  const wantsOwn = !wantsPublished || (chosenSources ?? []).length > 1

  /**
   * Keyed on the account, on what is asked for and on the word: another key is another library.
   *
   * 🛑 Not read before the key is known to work, and that is a fix rather than a saving. The
   * channel answers an EMPTY PAGE when no credentials resolve — `emptyIfUnauthenticated`, so a
   * first run without a key does not dump a stack per poll — which react-query then holds as a
   * successful, finished listing. Asked during the moment the keychain has not answered yet, the
   * panel therefore cached « this account owns nothing » and had no reason to ever ask again.
   */
  const library = usePages(
    ['assets', 'library', ownerId, cloudScope, search],
    from =>
      getBridge()
        ?.cloud.browse({
          pageSize: LIBRARY_PAGE,
          types: cloudScope,
          ...(search ? { text: search } : {}),
          ...from,
        })
        .then(cloudPage),
    { enabled: authenticated && wantsOwn },
  )
  const remote = library.items

  /**
   * What everyone else published, read only while the Source facet asks for it.
   *
   * The kind is the scope's first, which is the Type facet's answer wherever one is chosen and
   * the space's own kind otherwise: the feed pages by one kind, and this is the one on screen.
   */
  const publishedType = wantsPublished ? (cloudScope[0] ?? null) : null
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
    // And never without a key, for the reason the library above states.
    { enabled: publishedType !== null && authenticated },
  )
  const published = feed.items

  /** Which row is open. One at a time: two of these is a panel one scrolls twice. */
  const [expanded, setExpanded] = useState<string | null>(null)
  /**
   * What is picked, in a store of its own rather than in the selection one: that store speaks
   * catalogue ids, and none of these lines has one until it is downloaded — see `useLibraryPick`.
   */
  const picked = useLibraryPick(state => state.picked)
  const setPicked = useLibraryPick(state => state.setPicked)

  /**
   * The two tooltips a cell may carry, built once for the panel.
   *
   * A `useTranslation` inside a cell subscribes each of two hundred of them to i18next and
   * allocates a fresh attribute object on every frame of a scroll.
   */
  const hints = useMemo(
    () => ({
      fetch: HINT_LEFT(t('assets.fetchHint')),
      generating: HINT_LEFT(t('assets.generatingHint')),
    }),
    [t],
  )

  const rows = useMemo(
    () => mergeRows({ remote, published, jobs, scope }),
    [remote, published, jobs, scope],
  )

  /**
   * Which of these the project already holds — asked of the catalogue, over the ids actually
   * listed. It is what tells a line one can download from one already downloaded.
   */
  const listed = useMemo(
    () => rows.flatMap(row => (row.from === 'remote' ? [row.asset.id] : [])),
    [rows],
  )
  const twins = useRemoteTwins(listed)

  /**
   * Each line WITH the mark it wears, resolved once for the panel.
   *
   * Carried on the row rather than looked up per cell: a map meant every reader had to answer
   * "and if it is missing?" for a key built from the very list it indexes. The badge is a
   * property of the line, so the line holds it.
   */
  const marked = useMemo(() => {
    const inFlight = new Set(moving)

    return rows.map(row => ({ ...row, badge: markOf(row, { inFlight, twins }) }))
  }, [rows, moving, twins])

  const filtered = useMemo(
    () =>
      filterLocally(marked, collection, {
        /**
         * Nothing is matched in memory: the index has already matched these, on a prompt and a
         * description this side cannot see. Judged again here, a hit found on its PROMPT would
         * vanish from the very search that turned it up.
         */
        text: () => null,
        facets: {
          /**
           * A running generation holds no kind yet, so it holds them ALL: nothing about it says
           * it will not be the thing being looked for, and the panel exists to show it.
           */
          [TYPE_FACET]: row => {
            const type = typeOfRow(row)
            return type ? [type] : ASSET_TYPES
          },
          // Which library the line came from — the same answer that decided what was READ, so
          // the filter and the listing behind it cannot disagree.
          [SOURCE_FACET]: row =>
            row.from === 'remote' && row.published ? [PUBLISHED_SOURCE] : SOURCES_OF_OWN,
        },
      }),
    [marked, collection],
  )

  /**
   * How far each source has been read — and only the ones that have ANSWERED, which is where
   * this panel departs from the rule `mergeFeed` states. Counted from the first render, an
   * opening panel would go blank for as long as the API takes to reply. What the cut protects is
   * the SCROLL, and there every source has long since answered.
   */
  // The stamps rather than the lists: a refresh hands back a fresh array of the same rows, and
  // depending on it would walk the whole timeline again on every generation that lands.
  const libraryReadTo = remote.at(-1)?.createdAt
  const publishedReadTo = published.at(-1)?.createdAt

  const sources = useMemo<Partial<Record<FeedSourceName, FeedSource>>>(
    () => ({
      ...(library.pending
        ? {}
        : { library: { readTo: libraryReadTo, exhausted: library.exhausted } }),
      ...(publishedType !== null && !feed.pending
        ? { published: { readTo: publishedReadTo, exhausted: feed.exhausted } }
        : {}),
    }),
    [
      libraryReadTo,
      library.exhausted,
      library.pending,
      publishedReadTo,
      publishedType,
      feed.exhausted,
      feed.pending,
    ],
  )

  // Cut AFTER the filters: what is hidden has still been read, so the frontier is the same
  // either way, and cutting first would leave the tail of a filtered list unreachable.
  const { rows: shown, hungry } = useMemo(() => mergeFeed(filtered, sources), [filtered, sources])

  /** Asks the source holding the list back, and only it — which one it is changes as it goes. */
  // Through its contents, because `mergeFeed` allocates a fresh list every render: handed to the
  // end-of-list effect as it comes, a keystroke would re-arm it and spend a page on each one.
  const asking = hungry.join(' ')
  // Named apart because `exhaustive-deps` reads `library.more` as a dependency on `library`,
  // which takes a fresh identity every render and would re-arm the effect below with it.
  const readMoreLibrary = library.more
  const readMoreFeed = feed.more
  const askForMore = useCallback(() => {
    const wanted = asking.split(' ')
    if (wanted.includes('library')) readMoreLibrary()
    if (wanted.includes('published')) readMoreFeed()
  }, [asking, readMoreLibrary, readMoreFeed])

  // `ownerId` in the key: another account is another library, read from nothing — with the count
  // left where the previous one stopped, the panel would sit empty with no scroll able to fill it.
  useAutomaticPulls({
    key: `${ownerId} ${search} ${scope.join()} ${publishedType}`,
    drawn: shown.length,
    fetching: library.fetching || feed.fetching,
    // A page either of them answers with nothing moves no row on screen, and the panel would
    // stop one pull in with pages still to come.
    answered: `${library.pagesRead} ${feed.pagesRead}`,
    // Nobody to ask is not a pull worth spending: no source is holding the list back.
    ask: asking === '' ? null : askForMore,
  })

  /**
   * The count in the title row says what this list holds — the header is a separate component
   * and cannot see the library page or the filters from there.
   *
   * Cleared on the way out so a panel that has closed stops answering for the next one.
   */
  const shownLength = shown.length
  useEffect(() => {
    setShownCount(shownLength)
  }, [setShownCount, shownLength])
  // Its own effect, so the number is not dropped and re-published on every change of the list.
  useEffect(() => () => setShownCount(null), [setShownCount])
  // And the picked range with it: it addresses one library, and a panel that has closed must not
  // leave a range behind for whatever opens next.
  useEffect(() => () => setPicked(NOTHING), [setPicked])

  /**
   * Four situations, and the user can act on three of them.
   *
   * No key is asked FIRST: with none, nothing here can be read at all, and blaming a filter for
   * an empty panel would send someone hunting for one to clear.
   */
  const narrowedByHand = isFiltered(
    chosenTypes?.length === 1 && chosenTypes[0] === ownType
      ? setFacetValue(collection, TYPE_FACET, null)
      : collection,
  )
  // Read off `sources` rather than asked again: a source that has not answered is not in the
  // record, and two spellings of that question would drift apart.
  const reading = !('library' in sources) && !('published' in sources)
  const refused = library.refusal !== null || feed.refusal !== null

  if (!authenticated) return <MissingCredentials icon={mdiImageMultipleOutline} />

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CollectionBar scId="assets" state={collection} onChange={setCollection} facets={facets} />
      <Collection
        label={t('panels.assets')}
        multiple
        items={shown}
        state={collection}
        // A line of this panel carries a thumbnail, so it takes the media height rather than a
        // control's — kept from the batch this one landed on top of.
        rowHeight="media"
        // The panel owns its rows' gestures rather than each row wiring its own: that is what
        // puts these cells in the tab order, and what gives them the range a click could not ask
        // for. `LibraryAsset` keeps the drag and the menu, which belong to the row itself.
        selectedIds={picked}
        onSelect={(_row, ids, mode) => setPicked(applySelection(picked, ids, mode))}
        onReachEnd={askForMore}
        // One gesture, one meaning: a line with no bytes here is fetched FIRST and opened after
        // — stopping at the download left the user guessing that a second gesture was now
        // needed, and which one.
        onActivate={row => {
          if (row.from === 'remote' && project && !busy) void openFetched(row.asset.id)
        }}
        renderCard={row => (
          <AssetCard
            row={row}
            badge={row.badge}
            badgeLabels={badgeLabels}
            typeLabels={typeLabels}
            hints={hints}
          />
        )}
        // Held here rather than in the selection: opening a row is reading, not picking, and a
        // panel that opened whatever it selected would open a row on every arrow press.
        expandedId={expanded}
        // A running generation has no asset yet, so it has nothing to open onto.
        canOpen={row => row.from === 'remote'}
        onToggleRow={row => setExpanded(current => (current === row.id ? null : row.id))}
        renderRowDetail={row => (
          <AssetDetails row={row} twin={row.from === 'remote' ? twins.get(row.asset.id) : null} />
        )}
        renderRow={row => (
          <AssetRow
            row={row}
            typeLabel={typeLabelOf(row, typeLabels)}
            badge={row.badge}
            badgeLabels={badgeLabels}
            hints={hints}
          />
        )}
        empty={
          <EmptyState
            icon={mdiImageMultipleOutline}
            message={
              reading
                ? t('collection.loading')
                : refused
                  ? t('assets.libraryRefused')
                  : narrowedByHand
                    ? t('collection.noMatch')
                    : t('assets.noneRemote')
            }
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

/** Blank for a job: it has no kind to name until it answers, and a guess would be one. */
function typeLabelOf(row: AssetRowModel, labels: Map<AssetType, string>): string {
  const type = typeOfRow(row)
  return type ? (labels.get(type) ?? type) : ''
}
