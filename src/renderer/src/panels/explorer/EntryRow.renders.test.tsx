import { mdiFileOutline } from '@mdi/js'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RowModule from '@/design/Row'
import { EntryRow } from './EntryRow'

/**
 * Counted inside the row's own body. A probe component would sit above the memo boundary and
 * report the same figure whether the row bails out or not.
 */
const drawn = vi.hoisted(() => ({ rows: 0 }))

vi.mock('@/design/Row', async importOriginal => {
  const actual = await importOriginal<typeof RowModule>()
  return {
    ...actual,
    Row: (props: Parameters<typeof actual.Row>[0]) => {
      drawn.rows += 1
      return actual.Row(props)
    },
  }
})

const ENTRY = { name: 'plan.txt', icon: mdiFileOutline, open: false, waiting: false }

beforeEach(() => {
  drawn.rows = 0
})

describe('a row of the explorer', () => {
  /**
   * The panel re-renders three times for one click — a blur, a focus and a pick — and none of
   * them changes a row. Every prop below is a primitive, so the row can and must sleep through it.
   */
  it('is not drawn again when the panel re-renders around it', () => {
    const view = render(<EntryRow {...ENTRY} />)
    drawn.rows = 0

    for (let render = 0; render < 3; render += 1) view.rerender(<EntryRow {...ENTRY} />)

    expect(drawn.rows).toBe(0)
  })

  /** And it is drawn again the moment something it shows has changed. */
  it('is drawn again when the document behind it opens', () => {
    const view = render(<EntryRow {...ENTRY} />)
    drawn.rows = 0

    view.rerender(<EntryRow {...ENTRY} open />)

    expect(drawn.rows).toBe(1)
  })
})
