import type { ReactNode } from 'react'
import type { AiRoleId } from '@shared/domain/aiRole'
import { fieldHandle } from '@/design/scHandle'
import { WINDOW_CAPTION, WINDOW_HELP, WINDOW_ROW } from '@/design/windowStyles'
import { cn } from '@/helpers/cn'

export type AiChoiceRowProps = {
  /** The radio group: one provider serves a role, so picking one drops the last. */
  role: AiRoleId
  /** Which choice this is, within the role — a model id, or `automatic`, or `scenario`. */
  choice: string
  label: string
  /** The figures beside the name — a size, a verdict. */
  caption?: string
  /** Said under them when the caption alone would leave a dimmed row unexplained. */
  hint?: string
  checked: boolean
  disabled?: boolean
  onChoose: () => void
  /** What the row offers on its right: install, cancel, remove. */
  children?: ReactNode
}

/** One thing a role can be served by. Dimmed by the radio's own `disabled`, never by a second read. */
export function AiChoiceRow({
  role,
  choice,
  label,
  caption,
  hint,
  checked,
  disabled,
  onChoose,
  children,
}: AiChoiceRowProps) {
  return (
    <li className={cn(WINDOW_ROW, 'items-center')}>
      <label className="flex flex-1 items-start gap-2 has-[:disabled]:opacity-60">
        <input
          type="radio"
          name={`ai-role-${role}`}
          data-sc={fieldHandle(`ai.${role}.${choice}`)}
          className="radio radio-sm mt-0.5"
          checked={checked}
          disabled={disabled}
          onChange={onChoose}
        />
        <span className="flex flex-col">
          <span>{label}</span>
          {caption && <span className={WINDOW_CAPTION}>{caption}</span>}
          {hint && <span className={WINDOW_HELP}>{hint}</span>}
        </span>
      </label>

      {children}
    </li>
  )
}
