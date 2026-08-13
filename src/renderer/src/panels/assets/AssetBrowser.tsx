import { mdiImageMultipleOutline } from '@mdi/js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssetType } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { useToolLying } from '@/app/tool-zone'
import { Collection } from '@/design/Collection'
import { CollectionBar } from '@/design/CollectionBar'
import { EmptyState } from '@/design/EmptyState'
import { filterLocally, isFiltered } from '@/helpers/collection-state'
import { applySelection } from '@/helpers/selection'
import { openAsset } from '@/helpers/open-asset'
import { HINT_LEFT } from '@/helpers/tooltip'
import { assetTypesOf } from '@/helpers/workspaces'
import { useShelf } from '@/hooks/use-shelf'
import { getBridge } from '@/services/bridge'
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
import { useAssetFacets } from './facets'
import { LOCATION_FACET, useBadgeLabels } from './location-facet'
import { TYPE_FACET, useTypeLabels } from './type-facet'
import { markOf, mergeRows, nameOfRow, twinsById, typeOfRow, type AssetRowModel } from './rows'

/** How much of the account's library one panel reads. It pages no further today. */
const LIBRARY_PAGE = 60

const NO_REMOTE: readonly CloudAsset[] = []

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
  const collection = useAssets(state => state.collection)
  const setCollection = useAssets(state => state.setCollection)
  const project = useProject(state => state.project)
  const workspace = useLayouts(state => state.activeWorkspace)
  const ownerId = useSettings(activeOwnerId)
  const typeLabels = useTypeLabels()
  const badgeLabels = useBadgeLabels()
  const facets = useAssetFacets(typeLabels)
  const lying = useToolLying()
  const setScope = useAssets(state => state.setScope)
  const selectedIds = useSelection(selectedAssetIds)
  const jobs = useJobs(state => state.jobs)
  const busy = useCloud(state => state.busy)
  const moving = useCloud(state => state.moving)

  /**
   * What the space in front can actually take — a default, and one the user can step out of.
   *
   * Asked OF the catalogue rather than filtered out of its answer: the count in the header and
   * the "this project has no asset" message both read the same list, and a shelf that dropped
   * rows behind their backs would leave them describing a project nobody is looking at.
   *
   * Naming a kind switches the scope off entirely. Otherwise choosing "video" while painting
   * would answer nothing at all — two filters intersecting reads as broken, not as a scope.
   */
  const chosenType = Boolean(collection.selections[TYPE_FACET]?.length)
  const scope = useMemo(
    () => (chosenType ? null : assetTypesOf(workspace)),
    [chosenType, workspace],
  )
  useEffect(() => {
    setScope(scope)
  }, [setScope, scope])

  // Read again when the key changes — another key is another library — and when the space does,
  // since the kinds asked for change with it. Keyed rather than cached: the URL that draws a
  // library tile is signed and expires, so a page held for a fortnight draws broken pictures.
  const { value: remote } = useShelf(
    NO_REMOTE,
    () => browseLibrary(scope),
    `${ownerId ?? ''}/${scope?.join(',') ?? ''}`,
  )

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

  const twins = useMemo(() => twinsById(remote), [remote])
  const rows = useMemo(
    () => mergeRows({ local: items, remote, jobs, scope, absent }),
    [items, remote, jobs, scope, absent],
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

  const shown = useMemo(
    () =>
      filterLocally(marked, collection, {
        text: nameOfRow,
        facets: {
          // A running job has no kind to answer with, so a chosen kind hides it — which is the
          // honest answer: nothing yet says whether it will produce one.
          [TYPE_FACET]: row => {
            const type = typeOfRow(row)
            return type ? [type] : []
          },
          // Narrowed by what the badge says, so the filter and the mark beside it agree.
          [LOCATION_FACET]: row => [row.badge],
        },
      }),
    [marked, collection],
  )

  // An empty project and no project at all are different situations, and the user can only
  // act on one of them.
  const emptyMessage = isFiltered(collection)
    ? t('collection.noMatch')
    : project
      ? t('assets.none')
      : t('assets.openProject')

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* In a band the bar rides on the title row instead — see `AssetBrowserActions`. */}
      {!lying && <CollectionBar state={collection} onChange={setCollection} facets={facets} />}
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
        onActivate={row => {
          if (row.from === 'local') return void openAsset(row.asset)
          if (row.from === 'remote' && project && !busy) void openFetched(row.asset.id)
        }}
        renderCard={row => (
          <AssetCard row={row} badge={row.badge} badgeLabels={badgeLabels} hints={hints} />
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
        empty={<EmptyState icon={mdiImageMultipleOutline} message={emptyMessage} />}
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

/** One page of the account's library, narrowed to what the space in front can take. */
function browseLibrary(scope: readonly AssetType[] | null): Promise<CloudAsset[]> | undefined {
  return getBridge()
    ?.cloud.browse({ pageSize: LIBRARY_PAGE, ...(scope ? { types: scope } : {}) })
    .then(page => page.assets)
}

/** Blank for a job: it has no kind to name until it answers, and a guess would be one. */
function typeLabelOf(row: AssetRowModel, labels: Map<AssetType, string>): string {
  const type = typeOfRow(row)
  return type ? (labels.get(type) ?? type) : ''
}
