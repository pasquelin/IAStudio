import { screen, within } from '@testing-library/react'

/**
 * The controls of ONE folding section, as a scoped query.
 *
 * The texture face names a row after each of the eight channels, and four of those names are also
 * the name of a scalar further down — `Rugosité` is the map AND the number that multiplies it. A
 * query over the whole panel therefore answers two controls, and the section is what tells them
 * apart, exactly as it does on screen.
 */
export function inSection(title: string): ReturnType<typeof within> {
  const section = screen.getByRole('button', { name: title }).closest('section')
  if (!section) throw new Error(`no section titled ${title}`)

  return within(section)
}
