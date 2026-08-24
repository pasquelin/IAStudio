import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FolderEntry } from '@shared/domain/folder'
import { installFakeBridge } from '@/services/fakeBridge'
import { useProject } from '@/stores/project'
import { useFolderTree, type UnfoldableFolderTree } from './useFolderTree'

const folder = (name: string): FolderEntry => ({ path: name, name, kind: 'folder' })

/** The tree as a component sees it, and what the disk was asked for it. */
function mount() {
  useProject.setState({
    project: {
      path: '/projects/demo',
      manifest: { version: 1, name: 'demo', createdAt: '', updatedAt: '' },
    },
  })

  const listFolder = vi.fn(() => Promise.resolve([folder('Images'), folder('Textures')]))
  installFakeBridge({ project: { listFolder } })

  let tree: UnfoldableFolderTree | null = null

  function Host() {
    tree = useFolderTree(false)
    return null
  }

  render(<Host />)

  return {
    listFolder,
    // Read through a getter: every case looks at it after an `act`, never at the mounting value.
    tree: (): UnfoldableFolderTree => {
      if (!tree) throw new Error('the tree was never read')
      return tree
    },
  }
}

/** Lets the listing in flight land, which takes one turn of the microtask queue. */
const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('the project folder as a tree', () => {
  it('reads the root when it mounts', async () => {
    const { listFolder, tree } = mount()
    await settle()

    expect(listFolder).toHaveBeenCalledWith('', false)
    expect(tree().nodes.map(node => node.name)).toEqual(['Images', 'Textures'])
  })

  /**
   * Coming back to the window is a reading, and `FOLDER_ROOT` makes each one replace the whole
   * tree — so an unchanged answer handing back fresh nodes would re-sort the list and redraw
   * every row on every return to the front. The identity IS the assertion.
   */
  it('hands back the very tree it held when a reading says the same thing', async () => {
    const { tree } = mount()
    await settle()
    const held = tree()

    act(() => tree().reload())
    await settle()

    // The rows first: they are what the bail-out holds, and the tree around them what the panel
    // reads — failing on one rather than the other says which of the two gave way.
    expect(tree().nodes).toBe(held.nodes)
    expect(tree()).toBe(held)
  })

  it('takes on what the disk answers once it differs', async () => {
    const { listFolder, tree } = mount()
    await settle()

    listFolder.mockImplementation(() => Promise.resolve([folder('Images'), folder('Sky')]))
    act(() => tree().reload())
    await settle()

    expect(tree().nodes.map(node => node.name)).toEqual(['Images', 'Sky'])
  })
})
