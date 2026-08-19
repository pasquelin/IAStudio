import { useCallback, useState, type ReactNode } from 'react'
import { Flyout } from './Flyout'
import { STATUS_BUTTON } from './styles'
import { TIP_TOP } from '@/helpers/tooltip'

export type StatusFlyoutProps = {
  /** The tooltip's title. The face carries the visible words, so this names the button. */
  label: string
  /** What pressing it does — a face that shows a count says nothing about that. */
  hint: string
  /** What the button shows: a count, a bar, an icon. Already translated. */
  face: ReactNode
  /** What it raises, sized by the caller — a list wants a ceiling, a fixed pane wants a height. */
  panel: ReactNode
  /** Run as it opens, for the surface that treats opening as reading. */
  onOpen?: () => void
}

/**
 * A status-line button that raises a panel above itself. Written three times over — the journal,
 * the generations, the exports — down to the `w-12` of the bar and the `size={12}` of the chevron.
 */
export function StatusFlyout({ label, hint, face, panel, onOpen }: StatusFlyoutProps) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        {...TIP_TOP(label, false, hint)}
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.()
          setOpen(current => !current)
        }}
        className={STATUS_BUTTON}
      >
        {face}
      </button>

      {open && (
        <Flyout anchor={anchor} placement="above" onDismiss={close}>
          {panel}
        </Flyout>
      )}
    </>
  )
}
