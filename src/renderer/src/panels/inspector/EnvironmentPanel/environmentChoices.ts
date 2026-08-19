/**
 * One row per value of a union, labelled and explained from the bundle.
 *
 * A module beside the sections rather than inside one of them: several of them build rows the
 * same way, and importing one section from another closes a cycle.
 *
 * The keys are composed at runtime, so `dynamic-keys.i18n.test.ts` is what holds them — a value
 * without a bundle entry shows the raw key rather than failing to compile.
 */
import type { TFunction } from 'i18next'
import type { Choice } from '@/design/ChoiceField'

export function choicesOf<T extends string>(
  values: readonly T[],
  prefix: string,
  t: TFunction,
): Choice<T>[] {
  return values.map(value => ({
    value,
    label: t(`${prefix}${value}`),
    hint: t(`${prefix}${value}Hint`),
  }))
}
