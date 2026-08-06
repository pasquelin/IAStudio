import { twMerge } from 'tailwind-merge'

type ClassValue = string | false | null | undefined

/** Fusionne des classes Tailwind en laissant la dernière gagner. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(classes.filter(Boolean).join(' '))
}
