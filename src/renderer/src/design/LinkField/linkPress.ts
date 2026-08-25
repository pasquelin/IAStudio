/**
 * A press, as the button wears it and as the menu reads it: what it is called, what it explains.
 *
 * Its own module because both halves of the row need it — a type the parent declared and the
 * child re-imported is what `import-cycles.test.ts` catches.
 */
export type LinkPress = { label: string; hint: string; run: () => void }
