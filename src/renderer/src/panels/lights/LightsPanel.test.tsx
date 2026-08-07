import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultScene } from '@/engines/scene/default-scene'
import { EMPTY_SCENE } from '@/engines/scene/scene-state'
import { useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import { LightsActions, LightsPanel } from './LightsPanel'

function lights() {
  return sceneOf(useScenes.getState(), 'doc-1').nodes.filter(node => node.type === 'light')
}

beforeEach(() => {
  useScenes.setState({ states: { 'doc-1': createDefaultScene() }, histories: {} })
  useDocuments.setState({ activeId: 'doc-1' })
})

describe('LightsPanel', () => {
  it('lists the lights a new scene is born with', () => {
    render(<LightsPanel />)

    expect(screen.getByText('AmbientLight')).toBeInTheDocument()
    expect(screen.getByText('DirectionalLight')).toBeInTheDocument()
    expect(screen.getByText('HemisphereLight')).toBeInTheDocument()
  })

  it('warns that an unlit scene stays black rather than showing an empty box', () => {
    useScenes.setState({ states: { 'doc-1': EMPTY_SCENE }, histories: {} })
    render(<LightsPanel />)

    expect(screen.getByText('Aucune lumière. La scène restera noire.')).toBeInTheDocument()
  })

  it('adds the light chosen in the flyout, and undo removes it', async () => {
    render(<LightsActions />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter une lumière/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Projecteur/ }))

    expect(lights()).toHaveLength(4)
    expect(lights()[3]?.name).toBe('Projecteur')

    useScenes.getState().undo('doc-1')
    expect(lights()).toHaveLength(3)
  })

  it('hides a light through the history, and undo brings it back', async () => {
    render(<LightsPanel />)

    const eyes = screen.getAllByRole('button', { name: 'Afficher ou masquer' })
    await userEvent.click(eyes[0] as HTMLElement)
    expect(lights()[0]?.visible).toBe(false)

    useScenes.getState().undo('doc-1')
    expect(lights()[0]?.visible).toBe(true)
  })

  // The row selects on click, and so does the eye: unstopped, the selection wrote back a copy
  // of the scene taken before the toggle and swallowed it.
  it('leaves the selection alone when the eye is clicked', async () => {
    render(<LightsPanel />)

    const eyes = screen.getAllByRole('button', { name: 'Afficher ou masquer' })
    await userEvent.click(eyes[1] as HTMLElement)

    expect(sceneOf(useScenes.getState(), 'doc-1').selectedId).toBeNull()
  })
})
