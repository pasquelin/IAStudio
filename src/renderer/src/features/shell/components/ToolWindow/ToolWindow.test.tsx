import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collectionState'
import { useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { withQueries } from '../query-fixtures'
import { ToolWindow } from './ToolWindow'

/**
 * Under a query client, as `Application.tsx` mounts every panel: the shelf reads the account's
 * library a page at a time, and `useInfiniteQuery` is what holds its cursor.
 */
function renderShelf() {
  return render(
    withQueries(<ToolWindow tool="assets" zone="left" onFocus={vi.fn()} onClose={vi.fn()} />),
  )
}

/** The panel's own row: title, actions, close button. */
function headerOf(node: HTMLElement | null): HTMLElement | null {
  return node?.closest('header') ?? null
}

/**
 * Every panel arrives through `import()`, so nothing of its own is on screen on the first tick.
 * The RUNNER transforms the panel's subgraph on demand and took 2,6 s over the shelf here — a
 * figure that is the runner's, not the studio's, where the chunk is already built. Three seconds
 * is what `testSetup.ts` gives every awaited query, which would leave this one 400 ms of margin
 * on a machine that has already been measured seven times slower under load.
 *
 * `BUDGET` is the case's own, and it has to be: `testTimeout: 15_000` in `vitest.config.ts` is
 * NOT inherited by the projects — measured, a case of this project dies at vitest's default
 * 5 000 ms — so without it the case would expire before `ARRIVES` ever gave up.
 */
const ARRIVES = { timeout: 10_000 }
const BUDGET = 20_000

beforeEach(() => {
  useAssets.setState({ items: [], collection: DEFAULT_COLLECTION_STATE })
  useProject.setState({ project: null })
  useMedia.setState({ progress: {}, capabilities: { ffmpeg: true } })
  // The remote browser draws nothing at all without one — see `MissingCredentials`, and the
  // placement that keeps its icon off the rail entirely.
  useSettings.setState({ auth: { authenticated: true, ownerId: 'proj_a' } })
})

describe('a panel lying in a band', () => {
  // The montage, where this read the shelf until 17 August — the shelf stands in a column now,
  // and the timeline is the one panel left that hands a whole bar to a band's title row.
  function renderMontage() {
    return render(
      <ToolWindow tool="timeline" zone="bottomRight" onFocus={vi.fn()} onClose={vi.fn()} />,
    )
  }

  it('leaves the way out of the panel reachable beside it', () => {
    renderMontage()

    expect(screen.getByRole('button', { name: 'Retirer le module' })).toBeInTheDocument()
  })

  it('says the panel is on its way rather than showing nothing at all', () => {
    renderMontage()

    expect(screen.getByText('Chargement…')).toBeInTheDocument()
  })

  // A bar given `flex-1` weighs nothing when the row runs short, so every missing pixel is
  // taken from whatever else can shrink. The panel's name is not what should pay for it.
  it('keeps the panel name off the table when the row runs short', () => {
    const { container } = renderMontage()

    expect(container.querySelector('header > span')?.className).toContain('shrink-0')
  })

  // The room is given to the panel that asked for it, not to the zone: a panel that publishes
  // two buttons shares the band and would otherwise see them drift away from the close button.
  it('spreads the actions of the panel that declared it, and no other', () => {
    const { container } = render(
      <ToolWindow tool="scene" zone="bottomRight" onFocus={vi.fn()} onClose={vi.fn()} />,
    )

    const actions = container.querySelector('header > span:nth-of-type(2)')
    expect(actions?.className).toContain('ml-auto')
  })
})

describe('a panel standing in a column', () => {
  // 500 px of browser bar in a 320 px header pushed the close button out of the frame, which
  // is why the bar sits under the title here — and why the band is the exception, not the rule.
  it(
    'keeps its filter bar under the title',
    async () => {
      renderShelf()

      expect(headerOf(await screen.findByRole('searchbox', {}, ARRIVES))).toBeNull()
    },
    BUDGET,
  )
})
