import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Flyout, type FlyoutProps } from './Flyout'

describe('Flyout', () => {
  it('renders its rows outside the anchor, at the document root', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)

    render(
      <Flyout anchor={anchor}>
        <button type="button">Pinceau</button>
      </Flyout>,
    )

    const row = screen.getByRole('button', { name: 'Pinceau' })
    // Rendered inside the bar it would be clipped by its rounded, overflowing edge.
    expect(anchor.contains(row)).toBe(false)
  })

  it('renders nothing without an anchor', () => {
    render(
      <Flyout anchor={null}>
        <button type="button">Pinceau</button>
      </Flyout>,
    )
    expect(screen.queryByRole('button', { name: 'Pinceau' })).not.toBeInTheDocument()
  })

  /**
   * The anchor's box, which jsdom reports as zeros. `offsetWidth` comes from the layout polyfill
   * in `testSetup`, which answers 640 for every element — so the menu is 640 wide here.
   */
  function anchorAt(left: number, right: number): HTMLElement {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    anchor.getBoundingClientRect = () =>
      ({ top: 10, bottom: 30, left, right, width: right - left, height: 20 }) as DOMRect
    return anchor
  }

  function menuLeft(): string {
    return screen.getByRole('menu').style.left
  }

  it('hangs beside its anchor when there is room', () => {
    render(
      <Flyout anchor={anchorAt(80, 100)} role="menu">
        <button type="button">Pinceau</button>
      </Flyout>,
    )
    expect(menuLeft()).toBe('102px')
  })

  it('flips to the other side rather than drawing itself off the window', () => {
    // A section heading reaches the very right edge: hung to the right, its rows sit outside the
    // window and cannot be reached at all.
    render(
      <Flyout anchor={anchorAt(1000, 1020)} role="menu">
        <button type="button">Pinceau</button>
      </Flyout>,
    )
    expect(menuLeft()).toBe(`${1000 - 640 - 2}px`)
  })

  it('keeps the flipped side inside the window too', () => {
    // Flipping is not enough on its own: a menu wider than the room to the left of its anchor
    // lands at a negative x, and runs off the side it just flipped to. Every other placement
    // went through `clamped`; this branch was the one that did not.
    render(
      <Flyout anchor={anchorAt(300, 1020)} role="menu">
        <button type="button">Pinceau</button>
      </Flyout>,
    )
    expect(menuLeft()).toBe('0px')
  })

  /**
   * A field's menu takes the field's own box, the way a `<select>` does. The stacked placements
   * align RIGHT edges — right for a bar against the window edge, off-centre under a field, which
   * is what the new-document dialog came out looking like.
   */
  it('takes the anchor’s left edge and width under a field', () => {
    render(
      <Flyout anchor={anchorAt(80, 400)} placement="under" role="menu">
        <button type="button">Images</button>
      </Flyout>,
    )
    expect(menuLeft()).toBe('80px')
    expect(screen.getByRole('menu').style.width).toBe('320px')
  })

  it('keeps a field’s menu inside the window', () => {
    render(
      <Flyout anchor={anchorAt(900, 1220)} placement="under" role="menu">
        <button type="button">Images</button>
      </Flyout>,
    )
    // Clamped on the FIELD's width, not the menu's: the menu has just been given the field's.
    expect(menuLeft()).toBe(`${1024 - 320}px`)
  })

  // `role="menu"` promises rows a reader can step through. The surface also holds panels and
  // sliders, and announcing a menu over those sends a reader looking for rows that do not exist.
  it('carries no role of its own', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)

    render(
      <Flyout anchor={anchor}>
        <button type="button">Pinceau</button>
      </Flyout>,
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('announces a menu when its caller says the rows are menu items', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)

    render(
      <Flyout anchor={anchor} role="menu">
        <button type="button">Pinceau</button>
      </Flyout>,
    )
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  /**
   * The menu keyboard, opted into rather than assumed — the same shape as `onDismiss`, and for
   * the same reason: two callers open on hover, and a surface that grabs the focus as the
   * pointer passes over it takes the caret out of whatever was being typed.
   */
  describe('the keyboard', () => {
    const menu = (props: Partial<FlyoutProps> = {}) => {
      const anchor = document.createElement('div')
      document.body.appendChild(anchor)

      render(
        <Flyout anchor={anchor} role="menu" {...props}>
          <button type="button" role="menuitem">
            Pinceau
          </button>
          <button type="button" role="menuitem">
            Gomme
          </button>
        </Flyout>,
      )
      return anchor
    }

    it('walks the rows once a caller asks for it', async () => {
      menu({ onKeyClose: vi.fn() })
      expect(screen.getByRole('menuitem', { name: 'Pinceau' })).toHaveFocus()

      await userEvent.keyboard('{ArrowDown}')

      expect(screen.getByRole('menuitem', { name: 'Gomme' })).toHaveFocus()
    })

    it('closes on Tab through the callback it was handed', async () => {
      const onKeyClose = vi.fn()
      menu({ onKeyClose })

      await userEvent.keyboard('{Tab}')

      expect(onKeyClose).toHaveBeenCalled()
    })

    it('takes no focus at all from a caller that did not ask', () => {
      const outside = document.createElement('button')
      document.body.appendChild(outside)
      outside.focus()

      menu()

      expect(outside).toHaveFocus()
    })
  })

  /**
   * Three ways out through one hook, and a surface holding a decision has to tell them apart:
   * pressing outside and `Escape` are someone closing it, a window losing focus is not.
   */
  describe('the ways out', () => {
    const show = (props: Partial<FlyoutProps> = {}) => {
      const anchor = document.createElement('div')
      document.body.appendChild(anchor)
      const onDismiss = vi.fn()
      render(
        <Flyout anchor={anchor} onDismiss={onDismiss} {...props}>
          <button type="button">Pinceau</button>
        </Flyout>,
      )
      return { onDismiss }
    }

    /**
     * A menu raised from INSIDE the surface — and the inner one takes its OWN dismiss, which is
     * what tells « the menu answered » from « nobody answered at all ».
     */
    const nested = () => {
      const anchor = document.createElement('div')
      document.body.appendChild(anchor)
      const onDismiss = vi.fn()
      const onInner = vi.fn()
      const Nested = () => {
        const [opener, setOpener] = useState<HTMLButtonElement | null>(null)
        return (
          <Flyout anchor={anchor} onDismiss={onDismiss}>
            <button type="button" ref={setOpener}>
              Niveau
            </button>
            {opener && (
              <Flyout anchor={opener} onDismiss={onInner}>
                <button type="button">Information</button>
              </Flyout>
            )}
          </Flyout>
        )
      }
      render(<Nested />)

      return { onDismiss, onInner }
    }

    it('dismisses on a press outside it', async () => {
      const { onDismiss } = show()

      await userEvent.click(document.body)

      expect(onDismiss).toHaveBeenCalled()
    })

    // 🛑 The journal closed the moment a row of its own filter menu was pressed — see
    // `portalAnchors.ts` for why a portalled surface is a sibling and not a child.
    it('survives a press in a menu raised from inside it', async () => {
      const { onDismiss } = nested()

      await userEvent.click(screen.getByRole('button', { name: 'Information' }))

      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('dismisses on Escape', async () => {
      const { onDismiss } = show()

      await userEvent.keyboard('{Escape}')

      expect(onDismiss).toHaveBeenCalled()
    })

    // 🛑 The other half of the same defect: the pointer was taught to walk the chain and the key
    // was not, so Escape in the journal's own filter menu closed the journal underneath it.
    it('leaves Escape to the menu raised from inside it', async () => {
      const { onDismiss, onInner } = nested()

      await userEvent.keyboard('{Escape}')

      expect(onInner).toHaveBeenCalled()
      expect(onDismiss).not.toHaveBeenCalled()
    })

    /**
     * 🛑 The register answers « is one open », so a flyout with no dismiss of its own — the hover
     * preview of a link field is one — silenced Escape for the surface it sits in and answered it
     * for nobody.
     */
    it('still answers Escape under a menu that takes no dismiss of its own', async () => {
      const anchor = document.createElement('div')
      document.body.appendChild(anchor)
      const onDismiss = vi.fn()
      const Preview = () => {
        const [opener, setOpener] = useState<HTMLButtonElement | null>(null)
        return (
          <Flyout anchor={anchor} onDismiss={onDismiss}>
            <button type="button" ref={setOpener}>
              Lien
            </button>
            {opener && (
              <Flyout anchor={opener}>
                <span>Aperçu</span>
              </Flyout>
            )}
          </Flyout>
        )
      }
      render(<Preview />)

      await userEvent.keyboard('{Escape}')

      expect(onDismiss).toHaveBeenCalled()
    })

    // What a caller that asked for nothing else gets: leaving the window closes it like the rest.
    it('dismisses on the window losing focus, when nothing else was asked for', () => {
      const { onDismiss } = show()

      window.dispatchEvent(new Event('blur'))

      expect(onDismiss).toHaveBeenCalled()
    })

    it('hands a caller that asked its own answer for the window leaving, and only that one', () => {
      const onWindowLeave = vi.fn()
      const { onDismiss } = show({ onWindowLeave })

      window.dispatchEvent(new Event('blur'))

      expect(onWindowLeave).toHaveBeenCalled()
      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('still dismisses that caller on Escape, which is a decision and not a departure', async () => {
      const onWindowLeave = vi.fn()
      const { onDismiss } = show({ onWindowLeave })

      await userEvent.keyboard('{Escape}')

      expect(onDismiss).toHaveBeenCalled()
      expect(onWindowLeave).not.toHaveBeenCalled()
    })
  })
})
