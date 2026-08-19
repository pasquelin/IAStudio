/**
 * One row per value of a union, labelled from the bundle, for the `SelectField` every section of
 * this panel draws its choices with.
 *
 * A module beside the sections rather than inside one of them: several of them build rows the
 * same way, and importing one section from another closes a cycle.
 *
 * The keys are composed at runtime, so a guard is what holds them rather than the compiler: the
 * unions of `domain/scene` in `shared/i18n/bundles.test.ts`, the panel's own two in
 * `renderer/src/dynamic-keys.i18n.test.ts`. A value listed in neither ships its raw key on screen.
 */
import type { TFunction } from 'i18next'
import type { SelectOption } from '@/design/SelectField'

export type Choices<T extends string> = {
  options: readonly SelectOption<T>[]
  /**
   * What the value in hand does. A native list has nowhere to put a sentence per entry, so the
   * row tips this one — wrapped by the host, which alone knows which edge it sits against.
   */
  hintOf: (value: T) => string
}

/** Both halves at once, so the key prefix is written where the union is and nowhere else. */
export function choicesOf<T extends string>(
  values: readonly T[],
  prefix: string,
  t: TFunction,
): Choices<T> {
  return {
    options: values.map(value => ({ value, label: t(`${prefix}${value}`) })),
    hintOf: value => t(`${prefix}${value}Hint`),
  }
}
