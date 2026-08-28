/**
 * The database, reduced to what the catalogue and the memory use.
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
/**
 * What its readers bind. Deliberately narrower than what SQLite accepts.
 *
 * `Uint8Array` is here for one column — an embedding, which is a `Float32Array` seen as bytes.
 * Measured against both drivers before it was widened: `node:sqlite` and `better-sqlite3` each
 * accept it and each give it back as bytes, so a blob is genuinely exercised on either side.
 */
export type SqlValue = string | number | null | Uint8Array

/**
 * What SQLite gives back. Wider than `SqlValue`: an integer column can come back as a
 * `bigint`, and a blob as bytes. Callers narrow, they never assume.
 */
type SqlOutput = string | number | bigint | Uint8Array | null

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
