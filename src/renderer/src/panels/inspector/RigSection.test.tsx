import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { modelNodeFixture, rigStateFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type ModelNode } from '@/engines/scene/sceneState'
import { useModelClips } from '@/stores/modelClips'
import { installScene, sceneNodeIn, sceneNodeNow } from '@/stores/scene-fixtures'
import { useScenes } from '@/stores/scenes'
import { useSceneEdit } from '@/hooks/useSceneEdit'
import { RigSection } from './RigSection'

const DOCUMENT = 'doc-1'

const nodeOf = (): ModelNode | undefined => {
  const node = sceneNodeNow(DOCUMENT, 'a')
  return node?.type === 'model' ? node : undefined
}

function Host() {
  const node = useScenes(state => sceneNodeIn(state, DOCUMENT, 'a'))
  const edit = useSceneEdit(DOCUMENT)
  if (node?.type !== 'model') throw new Error('the fixture installs one model node')
  return <RigSection documentId={DOCUMENT} node={node} edit={edit} />
}

/** A model whose file has landed as a bare mesh of the given shape. */
function show(bounds = rigStateFixture([]).bounds, progress?: number): void {
  useModelClips.setState({
    rigs: { [DOCUMENT]: { a: { ...rigStateFixture([]), bounds } } },
    rigProgress: progress === undefined ? {} : { [DOCUMENT]: { a: progress } },
  })
  render(<Host />)
}

describe('RigSection', () => {
  beforeEach(() => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [modelNodeFixture('a')] })
    useModelClips.setState({ rigs: {}, rigProgress: {} })
  })

  it('says nothing while the file has not landed', () => {
    render(<Host />)

    expect(screen.queryByText('Squelette')).not.toBeInTheDocument()
  })

  it('offers to make a bare mesh animatable', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Rendre animable' }))

    expect(nodeOf()?.model.rig?.origin).toBe('local')
  })

  // Twenty-two bones carrying their humanoid roles: that is what makes retargeting possible
  // later, and the names are what a track addresses.
  it('writes a whole body, each bone named after the role it fills', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Rendre animable' }))

    const bones = nodeOf()?.model.rig?.bones ?? []
    expect(bones).toHaveLength(22)
    expect(bones.every(bone => bone.name === bone.role)).toBe(true)
    expect(bones.map(bone => bone.name)).toContain('LeftHand')
  })

  it('undoes the whole thing, since the rig is a document edit like any other', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Rendre animable' }))
    useScenes.getState().undo(DOCUMENT)

    expect(nodeOf()?.model.rig).toBeUndefined()
  })

  it('offers to take a skeleton back off once one is on', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Rendre animable' }))
    await userEvent.click(screen.getByRole('button', { name: 'Retirer le squelette' }))

    expect(nodeOf()?.model.rig).toBeUndefined()
  })

  /**
   * The proportions are read off the height. Saying why beats offering a button that would place
   * every bone across the body — and there is nothing to confirm, so nothing warns otherwise.
   */
  it('says why rather than offering the button, on a mesh it cannot fit', () => {
    show({ min: { x: -0.9, y: 0, z: -0.2 }, max: { x: 0.9, y: 0.4, z: 0.2 } })

    expect(screen.getByText(/couché/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rendre animable' })).not.toBeInTheDocument()
  })

  it('says why on a mesh too flat to hold a skeleton at all', () => {
    show({ min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 0, z: 1 } })

    expect(screen.getByText(/trop plat/)).toBeInTheDocument()
  })

  // Free and local, so there is no cost dialogue — but half a million vertices take a while, and
  // a window that said nothing would read as one that had not heard the click.
  it('shows how far along the binding is instead of the offer', () => {
    show(undefined, 0.4)

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rendre animable' })).not.toBeInTheDocument()
  })

  it('takes itself off for a model that already carries a skeleton of its own', () => {
    useModelClips.setState({ rigs: { [DOCUMENT]: { a: rigStateFixture(['Hips', 'Spine']) } } })
    render(<Host />)

    expect(screen.queryByText('Squelette')).not.toBeInTheDocument()
  })
})
