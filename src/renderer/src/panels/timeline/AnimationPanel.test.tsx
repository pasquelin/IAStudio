import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { canUndo } from '@/engines/core/history'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/scene-state'
import { installScene } from '@/stores/scene-fixtures'
import { useSceneViews } from '@/stores/scene-views'
import { historyOf, sceneOf, useScenes } from '@/stores/scenes'
import { AnimationPanel } from './AnimationPanel'

const DOCUMENT = 'doc-1'

const timelineOf = () => sceneOf(useScenes.getState(), DOCUMENT).animation
const tracks = () => timelineOf().tracks

/** A scene with one cube, picked — which is what the add buttons read. */
function withSelectedCube(): void {
  installScene(DOCUMENT, {
    ...EMPTY_SCENE,
    nodes: [meshNode('cube-1')],
    selectedIds: ['cube-1'],
  })
}

describe('AnimationPanel', () => {
  beforeEach(() => {
    withSelectedCube()
    useSceneViews.setState({ views: {} })
  })

  it('says what to do while no track has been added', () => {
    render(<AnimationPanel documentId={DOCUMENT} />)

    expect(screen.getByText(/Aucune piste/)).toBeInTheDocument()
  })

  it('adds a track for the picked object, one per property', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une piste Position/ }))
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une piste Échelle/ }))

    expect(tracks().map(track => track.target.property)).toEqual(['position', 'scale'])
    expect(tracks()[0]?.target.nodeId).toBe('cube-1')
  })

  it('offers no add button while nothing is picked, since a track needs a target', () => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [meshNode('cube-1')], selectedIds: [] })
    render(<AnimationPanel documentId={DOCUMENT} />)

    expect(screen.getByRole('button', { name: /Ajouter une piste Position/ })).toBeDisabled()
  })

  it('makes an added track undoable', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une piste Position/ }))

    expect(canUndo(historyOf(useScenes.getState(), DOCUMENT))).toBe(true)
  })

  it('sets a key where the head stands, and takes it back off', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une piste Position/ }))

    await userEvent.click(screen.getByRole('button', { name: /Poser une clé ici/ }))
    expect(tracks()[0]?.keys).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: /Retirer la clé posée ici/ }))
    expect(tracks()[0]?.keys).toHaveLength(0)
  })

  it('opens a key on the neutral value, so posing one moves nothing by itself', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une piste Échelle/ }))
    await userEvent.click(screen.getByRole('button', { name: /Poser une clé ici/ }))

    // One, not zero: the neutral of a scale is what leaves the object its own size.
    expect(tracks()[0]?.keys[0]?.value).toEqual({ x: 1, y: 1, z: 1 })
  })

  it('arms a track, which is what makes the gizmo write into it', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une piste Position/ }))
    await userEvent.click(screen.getByRole('button', { name: /Armer la piste/ }))

    expect(tracks()[0]?.armed).toBe(true)
  })

  it('keeps arming off the undo stack: it is how one works, not what one made', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une piste Position/ }))
    const before = historyOf(useScenes.getState(), DOCUMENT).past.length

    await userEvent.click(screen.getByRole('button', { name: /Armer la piste/ }))
    expect(historyOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before)
  })

  it('removes a track from its own row', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une piste Position/ }))
    await userEvent.click(screen.getByRole('button', { name: /Supprimer la piste/ }))

    expect(tracks()).toHaveLength(0)
  })

  it('runs the head back to the start', async () => {
    useSceneViews.getState().setPlayhead(DOCUMENT, 2)
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /Revenir au début/ }))

    expect(screen.getByText(/0\.00 \//)).toBeInTheDocument()
  })

  it('switches between playing and paused', async () => {
    render(<AnimationPanel documentId={DOCUMENT} />)
    await userEvent.click(screen.getByRole('button', { name: /^Lire/ }))

    expect(screen.getByRole('button', { name: /Mettre en pause/ })).toBeInTheDocument()
  })
})
