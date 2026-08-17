import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { modelNodeFixture, rigStateFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type ModelNode } from '@/engines/scene/sceneState'
import { useModelClips } from '@/stores/modelClips'
import { installScene, sceneNodeIn, sceneNodeNow } from '@/stores/scene-fixtures'
import { useScenes } from '@/stores/scenes'
import { AnimationSection } from './AnimationSection'
import { useSceneEdit } from '@/hooks/useSceneEdit'

const DOCUMENT = 'doc-1'

const nodeOf = (): ModelNode | undefined => {
  const node = sceneNodeNow(DOCUMENT, 'a')
  return node?.type === 'model' ? node : undefined
}

const playedOf = () => nodeOf()?.model.clips?.[0]

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

/** A model whose file has landed, carrying these clips and a skeleton nothing recognises. */
function show(clips: readonly string[] = ['walk', 'run'], bones: readonly string[] = []): void {
  useModelClips.setState({
    clips: { [DOCUMENT]: { a: clips } },
    rigs: { [DOCUMENT]: { a: rigStateFixture(bones) } },
  })
  render(<Host />)
}

describe('AnimationSection', () => {
  beforeEach(() => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [modelNodeFixture('a')] })
    useModelClips.setState({ clips: {}, rigs: {} })
  })

  it('says nothing at all while the file has not landed, having nothing to say about it yet', () => {
    render(<Host />)

    expect(screen.queryByText(/animable/)).not.toBeInTheDocument()
  })

  /**
   * Where the section used to take itself off. A mesh with no skeleton is the one case the studio
   * has something to offer, and saying nothing read as a feature that did not exist.
   */
  it('tells a bare mesh it cannot be animated yet, instead of showing nothing', () => {
    show([])

    expect(screen.getByText('Ce modèle n’est pas encore animable.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Clip')).not.toBeInTheDocument()
  })

  it('tells a rigged model the studio does not recognise what stands in the way', () => {
    show([], ['L_Thigh', 'L_Calf'])

    expect(
      screen.getByText('Ce modèle a un squelette dont aucune articulation n’est reconnue.'),
    ).toBeInTheDocument()
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
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')

    expect(playedOf()).toMatchObject({
      source: { kind: 'embedded', name: 'walk' },
      playing: true,
      offset: 0,
    })
  })

  it('pauses and resumes without losing the clip', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    await userEvent.click(screen.getByRole('button', { name: /Mettre en pause/ }))

    expect(playedOf()).toMatchObject({ source: { name: 'walk' }, playing: false })

    await userEvent.click(screen.getByRole('button', { name: /Jouer le clip/ }))
    expect(playedOf()?.playing).toBe(true)
  })

  it('clears the reference when the choice goes back to none', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    await userEvent.selectOptions(screen.getByLabelText('Clip'), '')

    expect(nodeOf()?.model.clips).toBeUndefined()
  })

  it('offers neither speed nor loop while no clip is chosen', () => {
    show()

    expect(screen.queryByLabelText('Vitesse')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('En boucle')).not.toBeInTheDocument()
  })

  it('writes the loop switch into the document', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    await userEvent.click(screen.getByLabelText('En boucle'))

    expect(playedOf()?.loop).toBe(false)
  })

  it('leaves the play button dead while nothing is chosen', () => {
    show()

    expect(screen.getByRole('button', { name: /Jouer le clip/ })).toBeDisabled()
  })

  it('keeps speed and loop when the clip is swapped for another', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    await userEvent.click(screen.getByLabelText('En boucle'))
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'run')

    expect(playedOf()).toMatchObject({
      source: { kind: 'embedded', name: 'run' },
      loop: false,
      playing: true,
    })
  })

  // The label follows the clip and never lags behind it: it is what the band draws, and a block
  // reading `walk` while `run` plays would name the wrong thing on the timeline.
  it('renames the block when the clip is swapped', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'run')

    expect(playedOf()?.label).toBe('run')
  })

  it('writes the speed the slider is dragged to', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    fireEvent.change(screen.getByLabelText('Vitesse'), { target: { value: '2' } })

    expect(playedOf()?.speed).toBe(2)
  })
})
