/** Identifiers for anything the user creates. One place to prefix or swap the generator. */
export function newId(): string {
  return crypto.randomUUID()
}
