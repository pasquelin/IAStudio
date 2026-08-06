import { DatabaseSync } from 'node:sqlite'
import type { SqliteDriver } from './sqlite'

/**
 * Test driver, backed by the SQLite built into Node. Real SQLite, so migrations and queries
 * are actually run — unlike a hand-written fake, which would only prove the fake agrees with
 * itself.
 */
export function openMemoryDatabase(file = ':memory:'): SqliteDriver {
  const database = new DatabaseSync(file)
  database.exec('PRAGMA foreign_keys = ON')

  return {
    exec: sql => database.exec(sql),
    prepare: sql => {
      const statement = database.prepare(sql)
      return {
        all: (...params) => statement.all(...params),
        get: (...params) => statement.get(...params),
        run: (...params) => void statement.run(...params),
      }
    },
    close: () => database.close(),
  }
}
