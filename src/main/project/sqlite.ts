/**
 * The database, reduced to what the catalogue uses.
 *
 * Two reasons, neither of them ABI: `better-sqlite3` v13 ships N-API prebuilds, so the same
 * binary does load under both Electron and Vitest.
 *
 * 1. Moving heavy queries onto a `worker_threads` pool swaps the driver rather than rewriting
 *    the catalogue — the catalogue is synchronous by nature, and blocking the main process
 *    blocks every window (CLAUDE.md, invariant 6).
 * 2. The test suite stays free of a native module, so it never depends on `pnpm rebuild:native`
 *    having been run. Tests bind `node:sqlite`, production binds `better-sqlite3` — both are
 *    real SQLite, so the migrations and the queries are genuinely exercised either way.
 */
/** What the catalogue binds. Deliberately narrower than what SQLite accepts. */
export type SqlValue = string | number | null

/**
 * What SQLite gives back. Wider than `SqlValue`: an integer column can come back as a
 * `bigint`, and a blob as bytes. Callers narrow, they never assume.
 */
export type SqlOutput = string | number | bigint | Uint8Array | null

export type SqlRow = Record<string, SqlOutput | undefined>

export type SqliteStatement = {
  all: (...params: SqlValue[]) => SqlRow[]
  get: (...params: SqlValue[]) => SqlRow | undefined
  run: (...params: SqlValue[]) => void
}

export type SqliteDriver = {
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
  close: () => void
}
