import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAssets } from '@/stores/assets'
import { AssetBrowserActions } from './AssetBrowserActions'

describe('AssetBrowserActions', () => {
  beforeEach(() => {
    useAssets.setState({ shownCount: null })
  })

  /**
   * 🛑 One thing, and it is a number. The four gestures that stood here until 25 August —
   * importing, describing, laying out a contact sheet, sending up — were all about the files
   * this project holds, and went with them to the Explorer's menus when this panel stopped
   * listing them. None of them has any meaning over a library this machine has no copy of.
   */
  it('keeps the title row to the one thing left on it', () => {
    useAssets.setState({ shownCount: 3 })

    render(<AssetBrowserActions />)

    expect(screen.getByText(/3 assets/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  /**
   * What the PANEL drew, not what the catalogue holds: the header is a separate component and
   * sees neither the library page nor the filters from there.
   */
  it('says nothing is drawn while no panel is mounted to answer', () => {
    render(<AssetBrowserActions />)

    expect(screen.getByText(/0 asset/)).toBeInTheDocument()
  })

  // A hint and not an `aria-label`: the number is already on screen, and one set over a visible
  // name replaces it for a screen reader (WCAG 2.5.3).
  it('explains which listings the number covers, rather than repeating it', () => {
    useAssets.setState({ shownCount: 3 })

    render(<AssetBrowserActions />)

    expect(screen.getByText(/3 assets/)).toHaveAttribute(
      'data-tooltip-content',
      expect.stringContaining('bibliothèque distante'),
    )
  })
})
