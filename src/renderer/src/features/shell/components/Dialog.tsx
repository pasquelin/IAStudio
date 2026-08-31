import type { ReactNode } from 'react'

export type DialogProps = {
  title: string
  children: ReactNode
  /** Its buttons, in reading order — the one that confirms last, where the eye ends. */
  actions: ReactNode
}

/**
 * A question the application asks as an application. DaisyUI here and not `design/`: this is one
 * of the surfaces CLAUDE.md reserves for it, beside the preferences and the keys.
 *
 * Written once for the two that ask one, and for the third that will: each of them drew the same
 * three DaisyUI classes, and a shell nobody shares is a shell that drifts.
 */
export function Dialog({ title, children, actions }: DialogProps) {
  return (
    <div className="modal modal-open" role="dialog" aria-label={title}>
      <div className="modal-box">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="py-4">{children}</div>
        <div className="modal-action">{actions}</div>
      </div>
    </div>
  )
}
