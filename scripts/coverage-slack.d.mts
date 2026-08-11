/**
 * The contract `src/main/coverage-slack.test.ts` reads the guard through.
 *
 * Declared rather than written in TypeScript because `scripts/` runs under bare node, with no
 * build step — the eight scripts beside it are all `.mjs`. Same shape as the two declarations in
 * `src/shared/types/`: a hand-written contract for something the compiler cannot infer.
 */

/** One coverage budget, as `vitest.config.ts` declares it. Negative counts uncovered items. */
export type Budget = {
  glob: string
  statements: number
  branches: number
}

/** Uncovered items a glob actually holds, or the room left between a budget and them. */
export type Counts = {
  statements: number
  branches: number
}

export declare const MAX_SLACK: number
export declare const SUMMARY: string

export declare function budgetsIn(config: string): Budget[]
export declare function matches(path: string, glob: string): boolean
export declare function carried(summary: unknown, glob: string, root: string): Counts
export declare function slackOf(config: string, summary: unknown, root: string): Budget[]
export declare function granted(rows: Budget[], max: number): Budget[]
