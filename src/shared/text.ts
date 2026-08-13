/**
 * The shape a text is searched by: accents dropped and case folded, so `thème` answers to
 * `theme` and `Forêt` to `foret`. A search box that demands a circumflex is a search box
 * nobody uses — and the hand that types into it is looking, not spelling.
 *
 * Decomposing first is what makes it work on either side: `é` typed as one character and `é`
 * typed as `e` plus an accent both come out as `e`, so a name pasted from elsewhere is found
 * by a name typed here.
 */
export function foldForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * The order of two strings NOBODY reads as words — an ISO stamp, a schema key, an id.
 *
 * `localeCompare` is the wrong tool twice over here. It answers in the locale the OS happens to
 * run in, so the same data would order differently on two machines; and it builds an ICU collator
 * per comparison, which a sort pays n·log n times for an order no reader ever sees. Code units
 * are what these strings mean: an ISO stamp sorts chronologically by construction.
 *
 * Text a person DOES read never comes here — it takes `localeCompare` with the language the
 * reader chose, which `no-bare-locale-compare.test.ts` is what makes sure of.
 */
export function byCodeUnit(one: string, other: string): number {
  if (one < other) return -1
  return one > other ? 1 : 0
}
