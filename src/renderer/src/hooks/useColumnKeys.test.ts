import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FolderColumn } from './useFolderColumns'
import { useColumnKeys } from './useColumnKeys'

const column = (folder: string, paths: readonly string[]): FolderColumn => ({
  folder,
  entries: paths.map(path => ({
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'folder',
  })),
  read: true,
})

const COLUMNS: readonly FolderColumn[] = [
  column('', ['3D', 'Images', 'Notes']),
  column('Images', ['Images/Croquis', 'Images/Rendus']),
  column('Images/Croquis', []),
]

const walked = (from: string, key: string): string | undefined => {
  const onChange = vi.fn()
  const { result } = renderHook(() => useColumnKeys(COLUMNS, onChange))

  act(() => result.current.onArrow(from, key))
  return onChange.mock.calls[0]?.[0] as string | undefined
}

describe('useColumnKeys', () => {
  it('moves down and up within one column', () => {
    expect(walked('3D', 'ArrowDown')).toBe('Images')
    expect(walked('Images', 'ArrowUp')).toBe('3D')
  })

  // The walk stops rather than wrapping: a list that jumps end to end loses whoever held the key.
  it('stays put at either end of a column', () => {
    expect(walked('3D', 'ArrowUp')).toBeUndefined()
    expect(walked('Notes', 'ArrowDown')).toBeUndefined()
  })

  it('steps into the folder chosen, onto its first row', () => {
    expect(walked('Images', 'ArrowRight')).toBe('Images/Croquis')
  })

  it('does not step into a folder holding none', () => {
    expect(walked('Images/Croquis', 'ArrowRight')).toBeUndefined()
  })

  // The folder a column LISTS is the parent of every row in it.
  it('steps back out onto the folder the column lists', () => {
    expect(walked('Images/Croquis', 'ArrowLeft')).toBe('Images')
  })

  it('has nowhere to step back out to from the project folder', () => {
    expect(walked('Images', 'ArrowLeft')).toBeUndefined()
  })

  // Moving the choice IS moving: a column browser has one notion, so the caret follows it.
  it('puts the caret where the walk went', () => {
    const { result } = renderHook(() => useColumnKeys(COLUMNS, vi.fn()))
    expect(result.current.focused).toBeNull()

    act(() => result.current.onArrow('3D', 'ArrowDown'))

    expect(result.current.focused).toBe('Images')
  })

  it('answers nothing for a row no column holds', () => {
    expect(walked('Ailleurs', 'ArrowDown')).toBeUndefined()
  })
})
