import { twMerge } from 'tailwind-merge'

type ClassValue = string | false | null | undefined

/** Merges Tailwind classes, letting the last one win. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(classes.filter(Boolean).join(' '))
}
