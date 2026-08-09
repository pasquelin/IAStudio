import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collection-state'
import { useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { ToolWindow } from './ToolWindow'

function renderShelf(zone: 'bottom' | 'left') {
  return render(<ToolWindow tool="assets" zone={zone} onFocus={vi.fn()} onClose={vi.fn()} />)
}

/** The panel's own row: title, actions, close button. */
function headerOf(node: HTMLElement | null): HTMLElement | null {
  return node?.closest('header') ?? null
}

/**
 * Every panel arrives through `import()`, so nothing of its own is on screen on the first tick.
 * A second — Testing Library's default — is not enough for the RUNNER, which transforms the
 * panel's subgraph on demand and took 2,6 s over the shelf here. That figure is the runner's,
 * not the studio's, where the chunk is already built.
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
})

describe('a panel lying in a band', () => {
  // A band is short and wide: a second row of controls under the title costs a tenth of the
  // shelf's height and buys nothing, since the row it sits on is mostly empty.
  it(
    'carries its filter bar on the title row',
    async () => {
      renderShelf('bottom')

      expect(headerOf(await screen.findByRole('searchbox', {}, ARRIVES))).not.toBeNull()
    },
    BUDGET,
  )

  it('leaves the way out of the panel reachable beside it', () => {
    renderShelf('bottom')

    expect(screen.getByRole('button', { name: 'Retirer le module' })).toBeInTheDocument()
  })

  // A bar given `flex-1` weighs nothing when the row runs short, so every missing pixel is
  // taken from whatever else can shrink. The panel's name is not what should pay for it.
  it('keeps the panel name off the table when the row runs short', () => {
    const { container } = renderShelf('bottom')

    expect(container.querySelector('header > span')?.className).toContain('shrink-0')
  })

  // The room is given to the panel that asked for it, not to the zone: the montage shares the
  // band and would otherwise see its own two buttons drift away from the close button.
  it('spreads the actions of the panel that declared it, and no other', () => {
    const { container } = render(
      <ToolWindow tool="timeline" zone="bottom" onFocus={vi.fn()} onClose={vi.fn()} />,
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
      renderShelf('left')

      expect(headerOf(await screen.findByRole('searchbox', {}, ARRIVES))).toBeNull()
    },
    BUDGET,
  )
})
