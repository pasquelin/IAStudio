import type { ReactNode } from 'react'

/**
 * What a slide stands on: a frosted sheet posed over the viewport, the way an inspector is posed
 * over the scene it inspects.
 *
 * Written after the slides were tried WITHOUT one. On the dark theme they read; on the light one
 * the account form was four white boxes floating on a light floor with nothing holding them, and
 * a caption at `/70` sat on whatever the key light happened to be doing under it. A sheet answers
 * both, and it is not the empty rectangle this window was rebuilt to escape — the room around it
 * is the 3D, and the sheet is IN it.
 *
 * The ground is a surface token at an alpha, which is a scrim and owes no ratio; what is written
 * on it is measured against `base-100` as anywhere else in the application windows.
 */
export function WelcomePanel({ children }: { children: ReactNode }) {
  return (
    <div className="bg-base-100/85 border-base-300/70 w-full max-w-md rounded-(--radius-sc-lg) border px-8 py-6 shadow-(--sc-shadow-floating) backdrop-blur-md">
      {children}
    </div>
  )
}
