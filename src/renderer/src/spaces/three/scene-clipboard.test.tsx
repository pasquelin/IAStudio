import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addNode } from '@/engines/scene/commands'
import { meshNode } from '@/engines/scene/scene-fixtures'
import type { SceneNode } from '@/engines/scene/scene-state'
import { useDocuments } from '@/stores/documents'
import { clearScenes } from '@/stores/scene-fixtures'
import { useSceneClipboard } from '@/stores/scene-clipboard'
import { sceneOf, selectIn, useScenes } from '@/stores/scenes'
import { SceneDocument } from './SceneDocument'

vi.mock('@/app/dockview-api', () => ({ setDocumentTitle: vi.fn() }))

// jsdom has no WebGL context: what this covers is the wiring between the keyboard and the store.
vi.mock('@/engines/scene/SceneRenderer', () => ({
  SceneRenderer: class {
    mount = vi.fn()
    apply = vi.fn()
    dispose = vi.fn()
    setMotion = vi.fn()
    configure = vi.fn()
    setMode = vi.fn()
    setSnapping = vi.fn()
    setSpace = vi.fn()
    setProjection = vi.fn()
    setDisplayMode = vi.fn()
    viewFrom = vi.fn()
    frameSelection = vi.fn()
  },
}))

function meshesOf(documentId: string): SceneNode[] {
  return sceneOf(useScenes.getState(), documentId).nodes.filter(node => node.type === 'mesh')
}

function openSecondScene(): void {
  useDocuments.setState({
    documents: { 'doc-2': { id: 'doc-2', kind: 'scene', workspace: '3d', title: 'Other' } },
    activeId: 'doc-2',
  })
  render(<SceneDocument documentId="doc-2" />)
}

beforeEach(() => {
  clearScenes()
  useSceneClipboard.setState({ nodes: [] })
  useDocuments.setState({
    documents: { 'doc-1': { id: 'doc-1', kind: 'scene', workspace: '3d', title: 'Set' } },
    activeId: 'doc-1',
  })
  useScenes.getState().runCommand('doc-1', addNode(meshNode('box-1')))
  selectIn('doc-1', ['box-1'])
})

describe('duplicating and pasting', () => {
  it('duplicates the selection, and selects the copy', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Meta>}{d}{/Meta}')

    const meshes = meshesOf('doc-1')
    expect(meshes).toHaveLength(2)
    // The copy, not the original: what was just made is what the next gesture acts on.
    expect(sceneOf(useScenes.getState(), 'doc-1').selectedIds).toEqual([meshes[1]?.id])
  })

  it('undoes a duplicate in one go', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Meta>}{d}{/Meta}')
    useScenes.getState().undo('doc-1')

    expect(meshesOf('doc-1')).toHaveLength(1)
  })

  it('copies without touching the scene, and pastes a separate copy', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Meta>}{c}{/Meta}')
    expect(meshesOf('doc-1')).toHaveLength(1)

    await userEvent.keyboard('{Meta>}{v}{/Meta}')
    const meshes = meshesOf('doc-1')
    expect(meshes).toHaveLength(2)
    expect(meshes[1]?.id).not.toBe(meshes[0]?.id)
  })

  // Two pastes of one copy must not put the same ids in twice.
  it('pastes twice as two separate objects', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Meta>}{c}{/Meta}')
    await userEvent.keyboard('{Meta>}{v}{/Meta}')
    await userEvent.keyboard('{Meta>}{v}{/Meta}')

    const ids = meshesOf('doc-1').map(node => node.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cuts what is selected, and can paste it back', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Meta>}{x}{/Meta}')
    expect(meshesOf('doc-1')).toHaveLength(0)

    await userEvent.keyboard('{Meta>}{v}{/Meta}')
    expect(meshesOf('doc-1')).toHaveLength(1)
  })

  it('does nothing at all with an empty clipboard', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Meta>}{v}{/Meta}')

    expect(meshesOf('doc-1')).toHaveLength(1)
  })

  // The clipboard belongs to the studio, not to a document.
  it('pastes into another scene what was copied in one', async () => {
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.keyboard('{Meta>}{c}{/Meta}')

    openSecondScene()
    await userEvent.keyboard('{Meta>}{v}{/Meta}')

    expect(meshesOf('doc-2')).toHaveLength(1)
  })

  // Its parent stayed behind: kept, the outliner would drop the node while the viewport still
  // drew it, and nothing could reach it again.
  it('roots a pasted node whose parent the destination does not hold', async () => {
    useScenes.getState().runCommand('doc-1', addNode(meshNode('child-1', 'box-1')))
    selectIn('doc-1', ['child-1'])
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.keyboard('{Meta>}{c}{/Meta}')

    openSecondScene()
    await userEvent.keyboard('{Meta>}{v}{/Meta}')

    expect(meshesOf('doc-2')[0]?.parentId).toBeNull()
  })

  it('greys Paste out until something has been copied', async () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Coller/ })).toBeDisabled()

    await userEvent.keyboard('{Meta>}{c}{/Meta}')
    expect(screen.getByRole('button', { name: /Coller/ })).toBeEnabled()
  })
})
