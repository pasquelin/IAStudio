import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { modelNodeFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type ModelNode } from '@/engines/scene/scene-state'
import { useModelClips } from '@/stores/model-clips'
import { installScene, sceneNodeIn, sceneNodeNow } from '@/stores/scene-fixtures'
import { useScenes } from '@/stores/scenes'
import { AnimationSection } from './AnimationSection'
import { useSceneEdit } from './useSceneEdit'

const DOCUMENT = 'doc-1'

const nodeOf = (): ModelNode | undefined => {
  const node = sceneNodeNow(DOCUMENT, 'a')
  return node?.type === 'model' ? node : undefined
}

/**
 * The section takes its node and its edit subscribed, so a write reaches the screen the way it
 * does in the panel. Narrower than `SceneInspector.tsx:43`, which watches the whole node list —
 * fair while the section reads nothing of the scene outside its own node, and to be widened the
 * day it does, or a write it should redraw on would leave this host still.
 */
function Host() {
  const node = useScenes(state => sceneNodeIn(state, DOCUMENT, 'a'))
  const edit = useSceneEdit(DOCUMENT)
  if (node?.type !== 'model') throw new Error('the fixture installs one model node')
  return <AnimationSection documentId={DOCUMENT} node={node} edit={edit} />
}

function show(clips: readonly string[] = ['walk', 'run']): void {
  useModelClips.setState({ clips: { [DOCUMENT]: { a: clips } } })
  render(<Host />)
}

describe('AnimationSection', () => {
  beforeEach(() => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [modelNodeFixture('a')] })
    useModelClips.setState({ clips: {} })
  })

  it('takes itself off while the file has brought no clip, rather than offering an empty picker', () => {
    show([])

    expect(screen.queryByLabelText('Séquence')).not.toBeInTheDocument()
  })

  it('offers every clip the file brought, plus a way back to none', () => {
    show()

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Aucune',
      'walk',
      'run',
    ])
  })

  it('starts a chosen clip playing, since a clip that sat still would read as a dead control', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Séquence'), 'walk')

    expect(nodeOf()?.model.animation).toMatchObject({ clip: 'walk', playing: true, time: 0 })
  })

  it('pauses and resumes without losing the clip', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Séquence'), 'walk')
    await userEvent.click(screen.getByRole('button', { name: /Mettre en pause/ }))

    expect(nodeOf()?.model.animation).toMatchObject({ clip: 'walk', playing: false })

    await userEvent.click(screen.getByRole('button', { name: /Jouer la séquence/ }))
    expect(nodeOf()?.model.animation?.playing).toBe(true)
  })

  it('clears the reference when the choice goes back to none', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Séquence'), 'walk')
    await userEvent.selectOptions(screen.getByLabelText('Séquence'), '')

    expect(nodeOf()?.model.animation).toBeUndefined()
  })

  it('offers neither speed nor loop while no clip is chosen', () => {
    show()

    expect(screen.queryByLabelText('Vitesse')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('En boucle')).not.toBeInTheDocument()
  })

  it('writes the loop switch into the document', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Séquence'), 'walk')
    await userEvent.click(screen.getByLabelText('En boucle'))

    expect(nodeOf()?.model.animation?.loop).toBe(false)
  })

  it('leaves the play button dead while nothing is chosen', () => {
    show()

    expect(screen.getByRole('button', { name: /Jouer la séquence/ })).toBeDisabled()
  })
  it('keeps speed and loop when the clip is swapped for another', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Séquence'), 'walk')
    await userEvent.click(screen.getByLabelText('En boucle'))
    await userEvent.selectOptions(screen.getByLabelText('Séquence'), 'run')

    expect(nodeOf()?.model.animation).toMatchObject({ clip: 'run', loop: false, playing: true })
  })

  it('writes the speed the slider is dragged to', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Séquence'), 'walk')
    fireEvent.change(screen.getByLabelText('Vitesse'), { target: { value: '2' } })

    expect(nodeOf()?.model.animation?.speed).toBe(2)
  })
})
