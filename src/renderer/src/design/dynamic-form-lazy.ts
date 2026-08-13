import { lazy } from 'react'

/**
 * The generation form, kept out of the opening chunk until something shows one.
 *
 * It drags zod, react-hook-form and its resolver behind it — 223 000 bytes measured on 10 August,
 * −219.62 kB when the split was first made on 8 August. The generator is placed in EVERY
 * workspace, so a static import would make a 3D session pay for a form it never renders.
 *
 * One panel shows it today, three did: each had written this `lazy` for itself, with this reason
 * written three times beside it. Declared once so a second caller has something to import rather
 * than a second copy to write — and so the guard below has one declaration to hold.
 *
 * Importing THIS module statically pulls nothing: its only export is the `lazy` below.
 * `dynamic-form-lazy.test.ts` holds both halves — that there is exactly one declaration, and that
 * this file never reaches the form any other way.
 */
export const DynamicForm = lazy(async () => ({
  default: (await import('./DynamicForm')).DynamicForm,
}))
