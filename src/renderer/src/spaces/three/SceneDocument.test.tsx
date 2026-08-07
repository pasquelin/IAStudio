import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addNode } from '@/engines/scene/commands'
import { DEFAULT_MATERIAL, IDENTITY_TRANSFORM, type SceneNode } from '@/engines/scene/scene-state'
import { sceneOf, useScenes } from '@/stores/scenes'
import { SceneDocument } from './SceneDocument'

const setMode = vi.fn()
const frameSelection = vi.fn()

// jsdom has no WebGL context: the renderer is exercised by hand, not here. What this test
// covers is that the document wires the toolbar and the keyboard to the right calls.
vi.mock('@/engines/scene/SceneRenderer', () => ({
  SceneRenderer: class {
    mount = vi.fn()
    unmount = vi.fn()
    apply = vi.fn()
    dispose = vi.fn()
    setMotion = vi.fn()
    setMode = setMode
    frameSelection = frameSelection
  },
}))

const box: SceneNode = {
  id: 'box-1',
  parentId: null,
  name: 'Box',
  visible: true,
  transform: IDENTITY_TRANSFORM,
  type: 'mesh',
  geometry: { kind: 'box', width: 1, height: 1, depth: 1 },
  material: DEFAULT_MATERIAL,
}

/** A new document is born with three lights; only the meshes are what these tests count. */
function meshesOf(documentId: string): SceneNode[] {
  return sceneOf(useScenes.getState(), documentId).nodes.filter(node => node.type === 'mesh')
}

describe('SceneDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useScenes.setState({ states: {}, histories: {} })
  })

  it('renders the shared toolbar with the scene tools', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Déplacer/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tourner/ })).toBeInTheDocument()
  })

  it('switches the gizmo mode when a tool is clicked', async () => {
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Tourner/ }))
    expect(setMode).toHaveBeenCalledWith('rotate')
  })

  it('switches the gizmo mode on the bound key', async () => {
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.keyboard('{r}')
    expect(setMode).toHaveBeenCalledWith('rotate')
  })

  it('deletes the selected object on the bound key', async () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Delete}')
    expect(meshesOf('doc-1')).toHaveLength(0)
  })

  it('undoes through the toolbar', async () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /Annuler/ }))
    expect(meshesOf('doc-1')).toHaveLength(0)
  })

  it('opens a new document on a lit scene rather than a black viewport', () => {
    render(<SceneDocument documentId="doc-fresh" />)
    const lights = sceneOf(useScenes.getState(), 'doc-fresh').nodes.filter(
      node => node.type === 'light',
    )
    expect(lights).toHaveLength(3)
  })

  it('does not reset a scene that is already open', () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    render(<SceneDocument documentId="doc-1" />)
    expect(meshesOf('doc-1')).toHaveLength(1)
  })

  it('disables undo when there is nothing to undo', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled()
  })
})
