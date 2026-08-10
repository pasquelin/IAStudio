/**
 * The characters French typography needs and a keyboard does not offer.
 *
 * Written as escapes on purpose: a literal no-break space is indistinguishable from an ordinary
 * one in a diff, in a review, and in the test that compares against it — which is exactly how it
 * gets lost. `bundles.test.ts` refuses an ordinary space before `;` `:` `!` `?` and `»`.
 */
export const NO_BREAK_SPACE = '\u00a0'
