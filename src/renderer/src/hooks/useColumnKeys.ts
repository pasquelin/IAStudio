import { useState } from 'react'
import { FOLDER_ROOT } from '@shared/domain/folder'
import type { FolderColumn } from './useFolderColumns'

export type ColumnKeys = {
  /** The row the keyboard last moved to, and the only one a column puts the caret on. */
  focused: string | null
  /** Answers an arrow pressed on `from`. Nothing happens where the walk cannot go that way. */
  onArrow: (from: string, key: string) => void
}

/** The four this answers. A key outside them is left to whatever else is listening. */
export const COLUMN_ARROWS: readonly string[] = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft']

/**
 * What an arrow means in a column browser, which is the Finder's answer: up and down move the
 * choice within a column, right steps INTO the folder chosen, left steps back out of it.
 *
 * Moving the choice IS moving — a column browser has one notion, not two — so every arrow ends
 * in `onChange`, and the caret follows it. Apart from the picker so that any surface reading
 * folders in columns walks them the same way: the rule is the hard half, not the drawing.
 */
export function useColumnKeys(
  columns: readonly FolderColumn[],
  onChange: (folder: string) => void,
): ColumnKeys {
  const [focused, setFocused] = useState<string | null>(null)

  const walk = (folder: string): void => {
    setFocused(folder)
    onChange(folder)
  }

  return {
    focused,
    onArrow: (from, key) => {
      const column = columns.find(one => one.entries.some(entry => entry.path === from))
      if (!column) return

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        const at = column.entries.findIndex(entry => entry.path === from)
        const next = column.entries[at + (key === 'ArrowDown' ? 1 : -1)]
        if (next) walk(next.path)
        return
      }

      // Into the folder: its own column is already read, since choosing it is what opened it.
      if (key === 'ArrowRight') {
        const child = columns.find(one => one.folder === from)?.entries[0]
        if (child) walk(child.path)
        return
      }

      // Back out: the folder this column lists IS the parent, and the root has nowhere to go.
      if (key === 'ArrowLeft' && column.folder !== FOLDER_ROOT) walk(column.folder)
    },
  }
}
