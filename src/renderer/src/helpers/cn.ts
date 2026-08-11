import { extendTailwindMerge } from 'tailwind-merge'

type ClassValue = string | false | null | undefined

/**
 * The steps of the ladder Tailwind does not ship. It reads a font size by its t-shirt shape
 * (`xs`, `sm`, `lg`…), so these looked like text COLOURS: a size and a colour in one call
 * cancelled each other. The why, the measurement and the guard live in
 * `design/text-scale.test.ts`, beside the sheet this list has to follow.
 */
const OWN_TEXT_STEPS = ['micro', 'mini', 'tiny', 'body']

const twMerge = extendTailwindMerge({ extend: { theme: { text: OWN_TEXT_STEPS } } })

/** Merges Tailwind classes, letting the last one win. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(classes.filter(Boolean).join(' '))
}
