import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addNode } from '@/engines/scene/commands'
import { meshNode } from '@/engines/scene/scene-fixtures'
import type { SceneNode } from '@/engines/scene/scene-state'
import { useDocuments } from '@/stores/documents'
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

const box = meshNode('box-1')

/** A new document is born with three lights; only the meshes are what these tests count. */
function meshesOf(documentId: string): SceneNode[] {
  return sceneOf(useScenes.getState(), documentId).nodes.filter(node => node.type === 'mesh')
}

describe('SceneDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useScenes.setState({ states: {}, histories: {} })
    useDocuments.setState({ activeId: 'doc-1' })
  })

  it('renders the shared toolbar with the scene tools', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Déplacer/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tourner/ })).toBeInTheDocument()
  })

  /**
   * A canvas React owns is reused across StrictMode's mount / unmount / mount, and the first
   * engine's `dispose` purges the one WebGL context the second one then draws into — a viewport
   * black for good. The engine makes its own canvas inside a plain host instead.
   */
  it('hands the renderer a host to fill, never a canvas of its own', () => {
    const { container } = render(<SceneDocument documentId="doc-1" />)
    expect(container.querySelector('canvas')).toBeNull()
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

  it('lets the keyboard alone while another tab is in front, since hidden tabs stay mounted', async () => {
    useDocuments.setState({ activeId: 'doc-2' })
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{r}')
    expect(setMode).not.toHaveBeenCalledWith('rotate')
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

  // Armed by default, and the one mode that leaves the gizmo off the selection.
  it('opens on the selection tool', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(setMode).toHaveBeenCalledWith('select')
  })

  it('adds the primitive chosen in the Add flyout, and undo removes it', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Cube/ }))

    expect(meshesOf('doc-1')).toHaveLength(1)
    expect(meshesOf('doc-1')[0]?.name).toBe('Box')

    await userEvent.click(screen.getByRole('button', { name: /Annuler/ }))
    expect(meshesOf('doc-1')).toHaveLength(0)
  })

  it('adds a light from the same flyout', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Projecteur/ }))

    const lights = sceneOf(useScenes.getState(), 'doc-1').nodes.filter(
      node => node.type === 'light',
    )
    expect(lights).toHaveLength(4)
  })

  it('adds nothing for a primitive that is not buildable yet', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter/ }))
    expect(await screen.findByRole('menuitem', { name: /Texte/ })).toBeDisabled()
    expect(meshesOf('doc-1')).toHaveLength(0)
  })
})
