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
