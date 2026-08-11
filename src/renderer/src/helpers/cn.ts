import { extendTailwindMerge } from 'tailwind-merge'

type ClassValue = string | false | null | undefined

/**
 * The four steps of the ladder Tailwind does not ship. The merger reads a font size by its
 * t-shirt shape (`xs`, `sm`, `lg`…), so `text-tiny` looked like a text COLOUR to it: a size and
 * a colour in one call cancelled each other, and `CONTROL` had been handing out its `text-text`
 * to no one. Declared here rather than inferred — `design/text-scale.test.ts` reads the sheet and
 * fails if a ninth step is added without joining this list.
 */
const LADDER_STEPS = ['micro', 'mini', 'tiny', 'body']

const twMerge = extendTailwindMerge({ extend: { theme: { text: LADDER_STEPS } } })

/** Merges Tailwind classes, letting the last one win. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(classes.filter(Boolean).join(' '))
}
