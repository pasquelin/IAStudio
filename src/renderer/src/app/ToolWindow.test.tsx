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

beforeEach(() => {
  useAssets.setState({ items: [], collection: DEFAULT_COLLECTION_STATE })
  useProject.setState({ project: null })
  useMedia.setState({ progress: {}, capabilities: { ffmpeg: true } })
})

describe('a panel lying in a band', () => {
  // A band is short and wide: a second row of controls under the title costs a tenth of the
  // shelf's height and buys nothing, since the row it sits on is mostly empty.
  it('carries its filter bar on the title row', () => {
    renderShelf('bottom')

    expect(headerOf(screen.getByRole('searchbox'))).not.toBeNull()
  })

  it('leaves the way out of the panel reachable beside it', () => {
    renderShelf('bottom')

    expect(screen.getByRole('button', { name: 'Retirer le module' })).toBeInTheDocument()
  })
})

describe('a panel standing in a column', () => {
  // 500 px of browser bar in a 320 px header pushed the close button out of the frame, which
  // is why the bar sits under the title here — and why the band is the exception, not the rule.
  it('keeps its filter bar under the title', () => {
    renderShelf('left')

    expect(headerOf(screen.getByRole('searchbox'))).toBeNull()
  })
})
