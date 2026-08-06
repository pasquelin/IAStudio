import Database from 'better-sqlite3'
import type { SqliteDriver, SqlRow, SqlValue } from './sqlite'

/**
 * Production driver. The only module importing `better-sqlite3`, and therefore the only one a
 * test must never reach: the binary is compiled for Electron's ABI and Vitest runs under Node.
 */
export function openNativeDatabase(file: string): SqliteDriver {
  const database = new Database(file)

  // Readers stop blocking the writer — the catalogue is queried while a job indexes into it.
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')

  return {
    exec: sql => void database.exec(sql),
    prepare: sql => {
      const statement = database.prepare<SqlValue[], SqlRow>(sql)
      return {
        all: (...params) => statement.all(...params),
        get: (...params) => statement.get(...params),
        run: (...params) => void statement.run(...params),
      }
    },
    close: () => database.close(),
  }
}
