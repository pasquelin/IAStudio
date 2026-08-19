import type { ReactNode } from 'react'
import { ROW_ACTIONS } from './styles'

export type FieldActionsProps = {
  /** The buttons this line ends with, if any. Right-aligned, and never more than two. */
  children?: ReactNode
}

/**
 * The room every property line keeps at its end, whether or not anything is drawn into it.
 *
 * Held by ALL of them and not only by the lines that act, which is what makes one column out of
 * six: a reset appearing the moment a value leaves its default used to narrow the field under the
 * pointer mid-drag — measured on 2026-08-19 at 86px going to 74px.
 */
export function FieldActions({ children }: FieldActionsProps) {
  return (
    <span aria-hidden={children === undefined} className={ROW_ACTIONS}>
      {children}
    </span>
  )
}
