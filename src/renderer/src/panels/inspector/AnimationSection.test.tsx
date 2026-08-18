import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { embeddedClip } from '@shared/domain/scene'
import { modelNodeFixture, rigStateFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type ModelNode } from '@/engines/scene/sceneState'
import { useModelClips } from '@/stores/modelClips'
import { installScene, sceneNodeIn, sceneNodeNow } from '@/stores/scene-fixtures'
import { useSceneViews } from '@/stores/sceneViews'
import { useScenes } from '@/stores/scenes'
import { AnimationSection } from './AnimationSection'
import { useSceneEdit } from '@/hooks/useSceneEdit'

const DOCUMENT = 'doc-1'

const nodeOf = (): ModelNode | undefined => {
  const node = sceneNodeNow(DOCUMENT, 'a')
  return node?.type === 'model' ? node : undefined
}

const playedOf = () => nodeOf()?.model.clips?.[0]

/** Which block the play button is holding — session state now, so it lives outside the document. */
const heldOf = () => useSceneViews.getState().views[DOCUMENT]?.selfPlay ?? null

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
    useSceneViews.setState({ views: {} })
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

    expect(playedOf()).toMatchObject({ source: { kind: 'embedded', name: 'walk' }, offset: 0 })
    expect(heldOf()).toEqual({ nodeId: 'a', clipId: playedOf()?.id })
  })

  it('pauses and resumes without losing the clip, and without touching the document', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    const chosen = playedOf()
    await userEvent.click(screen.getByRole('button', { name: /Mettre en pause/ }))

    expect(heldOf()).toBeNull()
    // The same object, not merely an equal one: pausing writes nothing into the scene, so ⌘Z
    // never gives a play button back.
    expect(playedOf()).toBe(chosen)

    await userEvent.click(screen.getByRole('button', { name: /Jouer le clip/ }))
    expect(heldOf()).toEqual({ nodeId: 'a', clipId: chosen?.id })
  })

  it('clears the reference when the choice goes back to none', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    await userEvent.selectOptions(screen.getByLabelText('Clip'), '')

    expect(nodeOf()?.model.clips).toBeUndefined()
  })

  /**
   * The section shows one block of a list that may hold several — the reader accepts them and the
   * band draws them all. Rewriting the whole field from this one control dropped the rest.
   */
  it('leaves the blocks it does not show alone when the played one is edited', async () => {
    const kept = embeddedClip('c2', 'run', { start: 5 })
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [
        {
          ...modelNodeFixture('a'),
          model: { assetId: 'asset-1', clips: [embeddedClip('c1', 'walk'), kept] },
        },
      ],
    })
    show()
    await userEvent.click(screen.getByLabelText('En boucle'))

    expect(nodeOf()?.model.clips?.map(clip => clip.id)).toEqual(['c1', 'c2'])
    expect(nodeOf()?.model.clips?.[1]).toEqual(kept)
  })

  // Its clip is gone from the file, so the picker lists nothing — but « none » has to stay
  // reachable, or a block that plays nothing could never be taken off.
  it('still offers a way out for a block whose clip the file no longer spells', async () => {
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [
        {
          ...modelNodeFixture('a'),
          model: { assetId: 'asset-1', clips: [embeddedClip('c1', 'gone')] },
        },
      ],
    })
    show([])
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

  // The label follows the clip rather than lagging behind it: it is what the band draws, and a
  // block reading `walk` while `run` plays would name the wrong thing on the timeline.
  it('keeps speed and loop when the clip is swapped, and renames the block', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    await userEvent.click(screen.getByLabelText('En boucle'))
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'run')

    expect(playedOf()).toMatchObject({
      source: { kind: 'embedded', name: 'run' },
      label: 'run',
      loop: false,
    })
  })

  it('writes the speed the slider is dragged to', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    fireEvent.change(screen.getByLabelText('Vitesse'), { target: { value: '2' } })

    expect(playedOf()?.speed).toBe(2)
  })
})
