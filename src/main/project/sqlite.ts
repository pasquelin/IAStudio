/**
 * The database, reduced to what the catalogue uses.
 *
 * It exists because a single native binary cannot serve both runtimes: `electron-rebuild`
 * compiles `better-sqlite3` for Electron's ABI, and Vitest runs under Node. Production binds
 * `better-sqlite3`, tests bind `node:sqlite` — both are real SQLite, so the migrations and
 * the queries are genuinely exercised either way.
 *
 * It earns its keep a second time: moving heavy queries onto a `worker_threads` pool will
 * swap the driver, not rewrite the catalogue — see CLAUDE.md, invariant 6.
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
