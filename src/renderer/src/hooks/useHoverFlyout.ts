import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { useForgettableTimeout } from './useForgettableTimeout'

export type HoverFlyout = {
  /** A single row is not a menu: the button acts directly, as map3D's toolbar does. */
  hasFlyout: boolean
  showing: boolean
  /** What the menu hangs from — the element `triggerProps` was spread on. */
  anchor: HTMLElement | null
  /**
   * Goes on the button that opens the menu: the anchor, what a screen reader is told about it,
   * and the APG chord.
   *
   * Here rather than at each mounting, because the two that spelt it out had already drifted: a
   * third one written for a whole-row trigger reached for `useState` and the ARIA pair and left
   * `Alt+ArrowDown` behind — the only opening a keyboard has on a button whose click does
   * something else. `onClick` stays with the caller: what a click means is exactly what the
   * three do not agree on.
   */
  triggerProps: {
    ref: (element: HTMLElement | null) => void
    'aria-haspopup': 'menu' | undefined
    'aria-expanded': boolean | undefined
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  }
  /**
   * Whether the menu was asked for — clicked, or keyed, which a button reports as a click —
   * rather than hovered into. Only an asked-for menu may take the focus and answer the arrows:
   * one the pointer merely crossed would pull the caret out of whatever was being typed.
   */
  asked: boolean
  /** Goes on the button whose menu this IS — never on a wrapper it shares with another one. */
  wrapProps: { onPointerEnter: () => void; onPointerLeave: () => void }
  /**
   * Goes on the menu itself — without it, reaching the rows closes them. It carries the menu's
   * manners too, so every mounting gets the same ones rather than three lines of policy each:
   * dismissal always, and the keyboard only once the menu was asked for.
   */
  flyoutProps: {
    onPointerEnter: () => void
    onPointerLeave: () => void
    /** A walk of the rows takes the menu out of the pointer's hands, whatever opened it. */
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
    onDismiss: () => void
    onKeyClose: (() => void) | undefined
  }
  /**
   * Opening it BY HAND — a click. The rows get the keyboard, but the pointer keeps the right to
   * close what it opened; only the chord read by `triggerProps` survives the pointer leaving.
   *
   * It records the opening whether or not there are rows to show, so a caller with a row count
   * that varies has to check `hasFlyout` first.
   */
  open: () => void
  close: () => void
}

/**
 * Milliseconds the menu survives the pointer leaving. The menu is portalled to the document
 * root and sits a few pixels off the bar, so the pointer is briefly over neither — without
 * this grace period the rows close before they can be reached, every time.
 */
const GRACE = 220

/**
 * What put the menu on screen, which is the whole state — three booleans made eight combinations
 * for four cases, and the grace period only ever cleared one of them.
 *
 * `pointer` was merely crossed and gets no keyboard; `hand` was clicked; `key` came through the
 * chord and is the one opening the pointer may not close.
 */
type Opening = null | 'pointer' | 'hand' | 'key'

/** What `useMenuKeys` walks the rows with. A row PRESSED is a choice, and closes on its own. */
const WALKING_KEYS: ReadonlySet<string> = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End'])

/** The chord exactly, no more: a fourth modifier held down means the user meant something else. */
const opensWith = (event: KeyboardEvent<HTMLElement>): boolean =>
  event.key === 'ArrowDown' && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey

export function useHoverFlyout(rowCount: number): HoverFlyout {
  const [openedBy, setOpenedBy] = useState<Opening>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const timeout = useForgettableTimeout()
  const hasFlyout = rowCount > 1

  // Never overwrites: the pointer crossing a menu that was asked for must not demote it to a
  // hovered one, which would take its keyboard away mid-walk.
  const enter = useCallback(() => {
    timeout.forget()
    setOpenedBy(opened => opened ?? 'pointer')
  }, [timeout])

  // Walking the rows with the arrows while the mouse sits elsewhere is ONE gesture, so only a
  // keyboard opening survives the pointer leaving. Everything else the pointer closes.
  const leave = useCallback(() => {
    if (openedBy === 'key') return
    timeout.after(GRACE, () => setOpenedBy(null))
  }, [openedBy, timeout])

  const ask = useCallback(
    (by: Opening) => {
      timeout.forget()
      setOpenedBy(by)
    },
    [timeout],
  )

  const close = useCallback(() => {
    timeout.forget()
    setOpenedBy(null)
  }, [timeout])

  /**
   * Wrapped rather than handed `ask` with a default: a caller passing it straight to `onClick`
   * gives it the `MouseEvent`, which any defaulted parameter would read as an opening.
   */
  const openByHand = useCallback(() => ask('hand'), [ask])

  // Walking the rows is a keyboard gesture whatever opened the menu: from the first arrow, the
  // mouse moving off the bar must not end it.
  const onRowsKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (WALKING_KEYS.has(event.key)) ask('key')
    },
    [ask],
  )

  const open = openedBy !== null
  const askedFor = hasFlyout && open && openedBy !== 'pointer'

  /**
   * Stopped as well as prevented: these buttons sit inside `Collection` cells, which walk the
   * list on a bare `ArrowDown` without looking at the modifiers. Left to bubble, one press
   * opened the menu and moved the focus a row on, anchoring the menu to a row nobody was on
   * any more.
   */
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!hasFlyout || !opensWith(event)) return
      event.preventDefault()
      event.stopPropagation()
      ask('key')
    },
    [ask, hasFlyout],
  )

  // One object per render, and every mounting spreads two of these: a fresh identity each time
  // is what would keep a memoised trigger re-rendering.
  return useMemo<HoverFlyout>(
    () => ({
      hasFlyout,
      showing: hasFlyout && open,
      asked: askedFor,
      anchor,
      triggerProps: {
        ref: setAnchor,
        // Announced before it opens, as `AccountSelect` does on the same mounting: a menu that
        // takes the focus without a reader having said it was coming is a jump out of nowhere.
        // Only when there IS one — with a single row the button acts outright, and announcing a
        // menu it will never show sends a screen reader looking for it.
        'aria-haspopup': hasFlyout ? 'menu' : undefined,
        'aria-expanded': hasFlyout ? open : undefined,
        onKeyDown,
      },
      wrapProps: { onPointerEnter: enter, onPointerLeave: leave },
      flyoutProps: {
        onPointerEnter: enter,
        onPointerLeave: leave,
        onKeyDown: onRowsKeyDown,
        onDismiss: close,
        onKeyClose: askedFor ? close : undefined,
      },
      open: openByHand,
      close,
    }),
    [anchor, askedFor, close, enter, hasFlyout, leave, onKeyDown, onRowsKeyDown, open, openByHand],
  )
}
