import { create } from 'zustand'
import { nextStyleName, type MaterialStyle } from '@shared/domain/style'
import type { MaterialSettings } from '@shared/domain/texture'
import { getBridge } from '@/services/bridge'
import { newId } from '@/helpers/ids'

type StylesState = {
  styles: readonly MaterialStyle[]
  /** Whether the file has been read once. Nothing outside this window writes it. */
  loaded: boolean

  /** Reads the file, once per window: every write answers with the whole list. */
  load: () => Promise<void>
  /**
   * Keeps the settings on screen under a generated name. The name is composed here rather than
   * in the main process: the word comes from the bundle, and only a window has one.
   */
  save: (values: MaterialSettings, prefix: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

/**
 * The saved material styles, as this window sees them.
 *
 * Held in a store rather than read per surface, exactly like the favourites: the inspector saves
 * and the panel lists, neither owns the list, and a style saved from the inspector has to appear
 * in the panel without a trip through the disk.
 */
export const useStyles = create<StylesState>()((set, get) => {
  const run = async (answer: Promise<MaterialStyle[]> | undefined): Promise<void> => {
    try {
      const styles = await answer
      if (styles) set({ styles, loaded: true })
    } catch {
      // An unreadable file is an empty panel, never a workspace that loses a panel over it.
      set({ loaded: true })
    }
  }

  return {
    styles: [],
    loaded: false,

    load: async () => {
      if (get().loaded) return
      await run(getBridge()?.styles.list())
    },

    save: (values, prefix) =>
      run(
        getBridge()?.styles.save({
          id: newId(),
          name: nextStyleName(get().styles, prefix),
          createdAt: new Date().toISOString(),
          // Copied on the way out: the settings handed in are the ones the texture is still
          // being edited with, and a style must not follow the next drag of the slider.
          values: structuredClone(values),
        }),
      ),

    rename: (id, name) => run(getBridge()?.styles.rename(id, name)),
    remove: id => run(getBridge()?.styles.remove(id)),
  }
})
