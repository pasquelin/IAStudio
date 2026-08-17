/**
 * The database, reduced to what the catalogue uses.
 *
 * Not an ABI concern: `better-sqlite3` v13 ships N-API prebuilds, so the same binary loads
 * under both Electron and Vitest. The port exists so the test suite stays free of a native
 * module and never depends on `pnpm rebuild:native` having been run — tests bind
 * `node:sqlite`, production binds `better-sqlite3`, and both are real SQLite, so the
 * migrations and the queries are genuinely exercised either way.
 *
 * It is NOT what keeps the main process responsive: swapping the driver could never do that,
 * since every method here is synchronous. The whole catalogue runs on its own thread instead —
 * see `catalogThread.ts`.
 */
/** What the catalogue binds. Deliberately narrower than what SQLite accepts. */
export type SqlValue = string | number | null

/**
 * What SQLite gives back. Wider than `SqlValue`: an integer column can come back as a
 * `bigint`, and a blob as bytes. Callers narrow, they never assume.
 */
type SqlOutput = string | number | bigint | Uint8Array | null

export type SqlRow = Record<string, SqlOutput | undefined>

type SqliteStatement = {
  all: (...params: SqlValue[]) => SqlRow[]
  get: (...params: SqlValue[]) => SqlRow | undefined
  run: (...params: SqlValue[]) => void
}

export type SqliteDriver = {
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
  close: () => void
}
