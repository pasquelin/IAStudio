import { useState } from 'react'
import { CONTROL } from '@/design/styles'
import { cn } from '@/helpers/cn'

export type NumberFieldProps = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  /** Appended after the box — dB, ×, s. */
  unit?: string
  onCommit: (value: number) => void
}

/**
 * A number the inspector writes back.
 *
 * Committed on blur and on Enter rather than on each keystroke: every write here is a command
 * on the undo stack, and typing "12" through would push a step for "1" as well.
 */
export function NumberField({ label, value, min, max, step, unit, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value))
  const [shown, setShown] = useState(value)

  // Adjusted while rendering rather than in an effect: the field has to follow the model when
  // it changes underneath — an undo, a drag on the strip — and an effect would render the
  // stale text first, then correct it.
  if (value !== shown) {
    setShown(value)
    setDraft(String(value))
  }

  const commit = (): void => {
    const parsed = Number(draft)
    if (Number.isFinite(parsed)) onCommit(parsed)
    else setDraft(String(value))
  }

  return (
    <span className="flex items-center justify-end gap-1">
      <input
        type="number"
        aria-label={label}
        className={cn(CONTROL, 'w-20 px-1 text-right')}
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          // The strip binds bare letters and Space; a number field must not split a clip.
          event.stopPropagation()
          if (event.key === 'Enter') commit()
        }}
        onBlur={commit}
      />
      {unit && <span className="text-muted w-4 shrink-0 text-left">{unit}</span>}
    </span>
  )
}
