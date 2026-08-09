import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MaterialStyle } from '@shared/domain/style'
import { isMissing } from '@main/scenario/job-store'
import { writeAtomic, writeQueue } from '@main/persistence'
import { parseStyles } from './validation'

export type StylesStore = {
  list: () => Promise<MaterialStyle[]>
  /** Answers the whole list, as the favourites do: one write, one truth back. */
  save: (style: MaterialStyle) => Promise<MaterialStyle[]>
  rename: (id: string, name: string) => Promise<MaterialStyle[]>
  remove: (id: string) => Promise<MaterialStyle[]>
}

const FILE_NAME = 'styles.json'

/**
 * The saved material styles, in the user's data folder — see `domain/style.ts` for why they live
 * outside every project.
 *
 * Written the way the favourites and the job notes are, and for the same reason: through a
 * staging copy renamed into place, refusing to rewrite from a list that could not be read, and
 * one write at a time. What is at stake is what a style exists to promise — that it is still
 * there, with the values it was saved with.
 */
export function createStyles(userDataPath: () => string): StylesStore {
  const fileOf = (): string => join(userDataPath(), FILE_NAME)

  const queue = writeQueue()

  /** The list, or `null` when the file is there and could not be read — not the same answer. */
  const read = async (): Promise<MaterialStyle[] | null> => {
    let content: string
    try {
      content = await readFile(fileOf(), 'utf8')
    } catch (error) {
      // Nothing saved yet. Anything else stops the write rather than rebuilding from a guess.
      return isMissing(error) ? [] : null
    }

    return parseStyles(content)
  }

  const write = async (styles: readonly MaterialStyle[]): Promise<MaterialStyle[]> => {
    await writeAtomic(fileOf(), JSON.stringify(styles, null, 2))
    return [...styles]
  }

  /** Runs one change against the file, after whichever change is already in flight. */
  const change = (
    body: (styles: MaterialStyle[]) => readonly MaterialStyle[],
  ): Promise<MaterialStyle[]> =>
    queue.next(async () => {
      const styles = await read()
      // Refusing beats rewriting from a list we could not read: the panel would come back short
      // of everything the failed read did not see, and nothing would say so.
      if (styles === null) throw new Error('styles could not be read')
      return write(body(styles))
    })

  return {
    list: async () => (await read()) ?? [],
    save: style => change(styles => [...styles, style]),
    rename: (id, name) =>
      change(styles => styles.map(style => (style.id === id ? { ...style, name } : style))),
    remove: id => change(styles => styles.filter(style => style.id !== id)),
  }
}
