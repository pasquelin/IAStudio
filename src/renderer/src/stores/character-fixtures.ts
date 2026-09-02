import { characterStore } from './character'

/** Puts the store back as it was built, so a suite never inherits the previous one's. */
export function clearCharacters(): void {
  characterStore.resetForTests()
}
