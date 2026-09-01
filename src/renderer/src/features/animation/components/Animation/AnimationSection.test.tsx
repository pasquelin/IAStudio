import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { bundledClip, clipLane, embeddedClip, type ClipLane } from '@shared/domain/scene'
import { SECOND } from '@shared/domain/time'
import { modelNodeFixture, rigStateFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type ModelNode } from '@/engines/scene/sceneState'
import { installFakeBridge } from '@/services/fakeBridge'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
import { useModelFiles } from '@/stores/modelFiles'
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

const heldOf = () => nodeOf()?.model.lanes?.[0]?.clips

const playedOf = () => heldOf()?.[0]

/** Whether the scene's head is running — the one clock, written by this button too. */
/** The block being watched on its own clock, which is what the play button drives now. */
const watchedNow = () => useSceneViews.getState().views[DOCUMENT]?.preview ?? null

const runningNow = () => watchedNow() !== null

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
  useModelFiles.setState({
    clips: { [DOCUMENT]: { a: clips } },
    rigs: { [DOCUMENT]: { a: rigStateFixture(bones) } },
  })
  render(<Host />)
}

describe('AnimationSection', () => {
  beforeEach(() => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [modelNodeFixture('a')] })
    useModelFiles.setState({ clips: {}, rigs: {} })
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({ views: {} })
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
    expect(runningNow()).toBe(true)
  })

  it('pauses and resumes without losing the clip, and without touching the document', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    const chosen = playedOf()
    await userEvent.click(screen.getByRole('button', { name: /Mettre en pause/ }))

    expect(runningNow()).toBe(false)
    // The same object, not merely an equal one: pausing writes nothing into the scene, so ⌘Z
    // never gives a play button back.
    expect(playedOf()).toBe(chosen)

    await userEvent.click(screen.getByRole('button', { name: /Jouer le clip/ }))
    expect(runningNow()).toBe(true)
  })

  /** A model node carrying these lanes, and nothing else changed. */
  const withLanes = (...lanes: ClipLane[]): void => {
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [{ ...modelNodeFixture('a'), model: { assetId: 'asset-1', lanes } }],
    })
  }

  /** A model holding two blocks in one lane, the second of which is chosen on the band. */
  const withTwoBlocks = (): void => {
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [
        {
          ...modelNodeFixture('a'),
          model: {
            assetId: 'asset-1',
            lanes: [
              clipLane('main', [
                embeddedClip('c1', 'walk', { speed: 1 }),
                embeddedClip('c2', 'run', { speed: 3, loop: false }),
              ]),
            ],
          },
        },
      ],
    })
  }

  // A model may hold several blocks: a section that always described the first could not speak
  // of the others, and changing a speed would have moved the wrong one.
  it('describes the block chosen on the band, not the first one', () => {
    withTwoBlocks()
    useAnimationViews.getState().setPickedBlock(DOCUMENT, 'c2')
    show()

    expect(screen.getByLabelText('Clip')).toHaveValue('run')
    expect(screen.getByLabelText('En boucle')).not.toBeChecked()
  })

  it('follows the choice when another block is picked', () => {
    withTwoBlocks()
    useAnimationViews.getState().setPickedBlock(DOCUMENT, 'c2')
    show()
    expect(screen.getByLabelText('Clip')).toHaveValue('run')

    act(() => useAnimationViews.getState().setPickedBlock(DOCUMENT, 'c1'))

    expect(screen.getByLabelText('Clip')).toHaveValue('walk')
  })

  it('edits the chosen block and leaves the other alone', async () => {
    withTwoBlocks()
    useAnimationViews.getState().setPickedBlock(DOCUMENT, 'c2')
    show()

    await userEvent.click(screen.getByLabelText('En boucle'))

    const clips = nodeOf()?.model.lanes?.[0]?.clips ?? []
    expect(clips.find(clip => clip.id === 'c2')?.loop).toBe(true)
    expect(clips.find(clip => clip.id === 'c1')?.loop).toBe(true)
    expect(clips.find(clip => clip.id === 'c1')?.speed).toBe(1)
  })

  // Two blocks driving the whole body average each other out; this control is the only place
  // that says otherwise, and a block edited elsewhere must keep what it was given.
  it('writes which half of the body the chosen block drives', async () => {
    withTwoBlocks()
    useAnimationViews.getState().setPickedBlock(DOCUMENT, 'c2')
    show()

    await userEvent.selectOptions(screen.getByLabelText('Pilote'), 'upper')

    const clips = nodeOf()?.model.lanes?.[0]?.clips ?? []
    expect(clips.find(clip => clip.id === 'c2')?.part).toBe('upper')
    expect(clips.find(clip => clip.id === 'c1')?.part).toBeUndefined()
  })

  it('watches the chosen block when play is pressed, and no other', async () => {
    withTwoBlocks()
    useAnimationViews.getState().setPickedBlock(DOCUMENT, 'c2')
    show()

    await userEvent.click(screen.getByRole('button', { name: /Jouer le clip/ }))

    expect(watchedNow()).toEqual({ nodeId: 'a', clipId: 'c2', at: 0, playing: true })
  })

  // Watching one animation is a look at a block, not a move of the scene's clock: wherever the
  // head stands, it is left there.
  it('leaves the head exactly where it stands, wherever that is', async () => {
    useModelFiles.setState({ lengths: { [DOCUMENT]: { a: { walk: 2 } } } })
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    await userEvent.click(screen.getByRole('button', { name: /Mettre en pause/ }))
    useSceneViews.getState().setPlayhead(DOCUMENT, 30 * SECOND)

    await userEvent.click(screen.getByRole('button', { name: /Jouer le clip/ }))

    expect(useSceneViews.getState().views[DOCUMENT]?.playhead).toBe(30 * SECOND)
  })

  // Two clocks driving one model is what makes a render disagree with the screen.
  it('gives the model back to the head as soon as the head is moved', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    expect(watchedNow()).not.toBeNull()

    useSceneViews.getState().setPlayhead(DOCUMENT, SECOND)

    expect(watchedNow()).toBeNull()
  })

  it('clears the reference when the choice goes back to none', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    await userEvent.selectOptions(screen.getByLabelText('Clip'), '')

    expect(nodeOf()?.model.lanes).toBeUndefined()
  })

  /**
   * The section shows one block of a list that may hold several — the reader accepts them and the
   * band draws them all. Rewriting the whole field from this one control dropped the rest.
   */
  it('leaves the blocks it does not show alone when the played one is edited', async () => {
    const kept = embeddedClip('c2', 'run', { start: 5 })
    withLanes(clipLane('main', [embeddedClip('c1', 'walk'), kept]))
    useAnimationViews.getState().setPickedBlock(DOCUMENT, 'c1')
    show()
    await userEvent.click(screen.getByLabelText('En boucle'))

    expect(heldOf()?.map(clip => clip.id)).toEqual(['c1', 'c2'])
    expect(heldOf()?.[1]).toEqual(kept)
  })

  // The band is where the layering is edited: an inspector that rewrote the whole field from one
  // control would take a stacked animation off without ever showing it.
  it('leaves the lanes it does not show alone', async () => {
    const other = clipLane('second', [embeddedClip('c3', 'wave')])
    withLanes(clipLane('main', [embeddedClip('c1', 'walk')]), other)
    useAnimationViews.getState().setPickedBlock(DOCUMENT, 'c1')
    show()
    await userEvent.click(screen.getByLabelText('En boucle'))

    expect(nodeOf()?.model.lanes?.[1]).toEqual(other)
  })

  // Its clip is gone from the file, so the picker lists nothing — but « none » has to stay
  // reachable, or a block that plays nothing could never be taken off.
  it('still offers a way out for a block whose clip the file no longer spells', async () => {
    withLanes(clipLane('main', [embeddedClip('c1', 'gone')]))
    useAnimationViews.getState().setPickedBlock(DOCUMENT, 'c1')
    show([])
    await userEvent.selectOptions(screen.getByLabelText('Clip'), '')

    expect(nodeOf()?.model.lanes).toBeUndefined()
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

  // It used to describe the first block of the first lane whenever nothing was picked, so Play
  // was armed over a block the person had never pointed at.
  it('says nothing of a block nobody picked, rather than falling back on the first', () => {
    withLanes(clipLane('main', [embeddedClip('c1', 'walk')]))
    show()

    expect(screen.getByLabelText('Clip')).toHaveValue('')
    expect(screen.getByRole('button', { name: /Jouer le clip/ })).toBeDisabled()
  })

  // The menu listed the file's own clips alone, so a library block fell on the first option and
  // « none » stood over a block that was playing.
  it('names a motion the file does not carry, instead of reading none', () => {
    withLanes(clipLane('main', [bundledClip('c1', 'Capoeira')]))
    useAnimationViews.getState().setPickedBlock(DOCUMENT, 'c1')
    show()

    expect(screen.getByLabelText('Clip')).toHaveDisplayValue('Capoeira')
    expect(screen.getByRole('button', { name: /Jouer le clip/ })).toBeEnabled()
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

  // Both edges from one control: what is being set is how this move joins its neighbours, and
  // the fields were honoured by the band long before anything wrote them.
  it('writes a transition on both edges of the chosen block', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    fireEvent.change(screen.getByLabelText('Transition'), { target: { value: '0.5' } })

    expect(playedOf()).toMatchObject({ fadeIn: 0.5 * SECOND, fadeOut: 0.5 * SECOND })
  })

  it('writes whether the block moves the character or plays on the spot', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'walk')
    await userEvent.selectOptions(screen.getByLabelText('Déplacement du personnage'), 'inPlace')

    expect(playedOf()?.rootMotion).toBe('inPlace')
  })

  // What the FILE spells reaches nobody: Tripo writes `NlaTrack`, and the value behind the option
  // stays the file's so that choosing it still finds the clip.
  it('offers a clip the exporter never named under a name of the app', async () => {
    show(['NlaTrack'])

    expect(screen.getByRole('option', { name: 'Animation' })).toHaveValue('NlaTrack')
    await userEvent.selectOptions(screen.getByLabelText('Clip'), 'NlaTrack')

    expect(playedOf()?.source).toEqual({ kind: 'embedded', name: 'NlaTrack' })
  })

  describe('the block the picker lays', () => {
    /** Opens the picker on a rigged model and chooses the one motion the studio ships with. */
    const lay = async (): Promise<void> => {
      installFakeBridge({
        animations: { list: () => Promise.resolve([{ name: 'Capoeira', thumbnail: false }]) },
      })
      show([], ['mixamorig:Hips'])
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter une animation' }))
      await userEvent.click(await screen.findByRole('button', { name: 'Capoeira' }))
    }

    it('stays on the band once it is kept', async () => {
      await lay()
      await userEvent.click(screen.getByRole('button', { name: 'Garder' }))

      expect(heldOf()?.map(clip => clip.label)).toEqual(['Capoeira'])
    })

    it('goes back only when it is cancelled', async () => {
      await lay()
      await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

      expect(heldOf() ?? []).toEqual([])
    })

    // Browsing picks what it lays, so cancelling has to put back what was chosen before — the
    // section went blank over a block the person had never touched.
    it('gives the band back the block that was chosen before it opened', async () => {
      installFakeBridge({
        animations: { list: () => Promise.resolve([{ name: 'Capoeira', thumbnail: false }]) },
      })
      withLanes(clipLane('main', [embeddedClip('c1', 'walk')]))
      useAnimationViews.getState().setPickedBlock(DOCUMENT, 'c1')
      show([], ['mixamorig:Hips'])

      await userEvent.click(screen.getByRole('button', { name: 'Ajouter une animation' }))
      await userEvent.click(await screen.findByRole('button', { name: 'Capoeira' }))
      await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

      expect(animationViewOf(useAnimationViews.getState(), DOCUMENT).pickedBlock).toBe('c1')
    })

    /** Switching to another application is not an answer: alt-tab must not decide for anyone. */
    it('survives the window losing focus', async () => {
      await lay()
      act(() => window.dispatchEvent(new Event('blur')))

      expect(heldOf()?.map(clip => clip.label)).toEqual(['Capoeira'])
    })

    it('goes back on Escape, which is the way out of every other surface', async () => {
      await lay()
      await userEvent.keyboard('{Escape}')

      expect(heldOf() ?? []).toEqual([])
    })

    // A ⌘Z takes the block out from under the picker. Taking it back off again would rewrite the
    // document for nothing AND wipe the redo — the ⌘Y would vanish unannounced.
    it('leaves the history alone when the block it laid has already been undone', async () => {
      await lay()
      act(() => useScenes.getState().undo(DOCUMENT))
      expect(heldOf() ?? []).toEqual([])

      await userEvent.keyboard('{Escape}')
      act(() => useScenes.getState().redo(DOCUMENT))

      expect(heldOf()?.map(clip => clip.label)).toEqual(['Capoeira'])
    })
  })
})
