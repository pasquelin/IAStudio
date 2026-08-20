import type { ReactNode } from 'react'

/**
 * The hooks listen on `window`; the field is here so a test can move focus into one — which is
 * the difference between a command and a held command, so both suites mount the same wrapper.
 */
export function ShortcutsFixture({ children }: { children: ReactNode }) {
  return (
    <div>
      <input aria-label="prompt" />
      {children}
    </div>
  )
}
