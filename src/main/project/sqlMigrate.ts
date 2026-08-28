import type { SqliteDriver } from './sqlite'
import { optionalNumber } from './sqlRow'

/**
 * Schema history, applied. The INDEX in the list is the version, so the list is append only:
 * rewriting a past entry would leave already-created databases on a schema nobody describes.
 */

function schemaVersion(driver: SqliteDriver): number {
  const row = driver.prepare('PRAGMA user_version').get()
  return row ? (optionalNumber(row, 'user_version') ?? 0) : 0
}

export function migrateTo(driver: SqliteDriver, migrations: readonly string[]): void {
  for (let version = schemaVersion(driver); version < migrations.length; version++) {
    driver.exec(migrations[version] ?? '')
    driver.exec(`PRAGMA user_version = ${version + 1}`)
  }
}

/**
 * All or nothing, on a driver where forgetting the `ROLLBACK` leaves a transaction open for the
 * rest of the session — and every window behind it.
 */
export function transaction<T>(driver: SqliteDriver, body: () => T): T {
  driver.exec('BEGIN')
  try {
    const result = body()
    driver.exec('COMMIT')
    return result
  } catch (error) {
    driver.exec('ROLLBACK')
    throw error
  }
}
