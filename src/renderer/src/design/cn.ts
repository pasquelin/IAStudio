import { twMerge } from 'tailwind-merge'

type Classe = string | false | null | undefined

/** Fusionne des classes Tailwind en laissant la dernière gagner. */
export function cn(...classes: Classe[]): string {
  return twMerge(classes.filter(Boolean).join(' '))
}
