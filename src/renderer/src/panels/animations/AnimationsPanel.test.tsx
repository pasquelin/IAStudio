import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { modelNodeFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { useDocuments } from '@/stores/documents'
import { useModelClips } from '@/stores/modelClips'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, selectIn, useScenes } from '@/stores/scenes'
import { useSceneViews } from '@/stores/sceneViews'
import { installFakeBridge } from '@/services/fakeBridge'
import { AnimationsPanel } from './AnimationsPanel'
import { ANIMATION_DRAG_TYPE } from './dragged'

const DOCUMENT = 'doc-1'

/** A model in front, holding the clips its own file brought. */
function withCharacter(clips: readonly string[]): void {
  const node = modelNodeFixture('perso')
  installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [node], selectedIds: [node.id] })
  useModelClips.getState().report(DOCUMENT, node.id, clips)
}

describe('the animations panel', () => {
  beforeEach(() => {
    installFakeBridge()
    useDocuments.setState({ activeId: DOCUMENT })
    useModelClips.setState({ clips: {}, rigs: {} })
    // Or the block one case watched decides what the next one shows as playing.
    useSceneViews.setState({ views: {} })
    installScene(DOCUMENT, EMPTY_SCENE)
  })

  it('says what to do when there is nothing to play yet', async () => {
    render(<AnimationsPanel />)

    await waitFor(() => expect(screen.getByText(/Aucune animation/)).toBeInTheDocument())
  })

  // `NlaTrack` is the default name of a Blender NLA track and what a Tripo rig ships with: the
  // studio names such a clip itself rather than letting the exporter name it.
  it('lists the clips the character in front brought, under names of its own', async () => {
    withCharacter(['NlaTrack', 'run'])
    render(<AnimationsPanel />)

    await waitFor(() => expect(screen.getByText('Animation')).toBeInTheDocument())
    expect(screen.queryByText('NlaTrack')).not.toBeInTheDocument()
    expect(screen.getByText('run')).toBeInTheDocument()
  })

  it('lists the animations shipped with the app, by their folder name', async () => {
    installFakeBridge({
      animations: { list: () => Promise.resolve([{ name: 'walk', thumbnail: false }]) },
    })
    render(<AnimationsPanel />)

    await waitFor(() => expect(screen.getByText('walk')).toBeInTheDocument())
  })

  // Dragged by its NAME and nothing else: the band writes that name into the document, and a
  // path off this machine would name a file the next one has not got.
  it('hands the band the folder name when a shipped animation is dragged', async () => {
    installFakeBridge({
      animations: { list: () => Promise.resolve([{ name: 'walk', thumbnail: false }]) },
    })
    render(<AnimationsPanel />)
    await waitFor(() => expect(screen.getByText('walk')).toBeInTheDocument())

    const carried = new Map<string, string>()
    screen
      .getByText('walk')
      .closest('[draggable]')
      ?.dispatchEvent(
        Object.assign(new Event('dragstart', { bubbles: true }), {
          dataTransfer: { setData: (type: string, value: string) => void carried.set(type, value) },
        }),
      )

    expect(JSON.parse(carried.get(ANIMATION_DRAG_TYPE) ?? 'null')).toEqual({
      kind: 'bundled',
      name: 'walk',
    })
  })

  // The drag is what puts a block on a lane, so a row that carries nothing is a row that does
  // nothing — and nothing on screen would say so.
  it('hands the band what it needs when a row is dragged', async () => {
    withCharacter(['NlaTrack'])
    render(<AnimationsPanel />)
    await waitFor(() => expect(screen.getByText('Animation')).toBeInTheDocument())

    const carried = new Map<string, string>()
    const row = screen.getByText('Animation').closest('[draggable]')
    row?.dispatchEvent(
      Object.assign(new Event('dragstart', { bubbles: true }), {
        dataTransfer: { setData: (type: string, value: string) => void carried.set(type, value) },
      }),
    )

    expect(JSON.parse(carried.get(ANIMATION_DRAG_TYPE) ?? 'null')).toEqual({
      kind: 'embedded',
      clip: 'NlaTrack',
    })
  })

  it('leaves the rows of a character out when what is in front is not one', async () => {
    withCharacter(['NlaTrack'])
    installScene(DOCUMENT, { ...EMPTY_SCENE, selectedIds: [] })
    render(<AnimationsPanel />)

    await waitFor(() => expect(screen.getByText(/Aucune animation/)).toBeInTheDocument())
  })

  /** Every block of the scene, or those of one character when a node is named. */
  const blocksOf = (nodeId?: string) =>
    sceneOf(useScenes.getState(), DOCUMENT).nodes.flatMap(node =>
      node.type === 'model' && (nodeId === undefined || node.id === nodeId)
        ? (node.model.lanes?.flatMap(lane => lane.clips) ?? [])
        : [],
    )

  // The block IS the preview — the same trade the picker makes, since a rehearsal that differed
  // from the result would be a defect rather than an approximation.
  it('lays the real block on the character and watches it', async () => {
    withCharacter(['NlaTrack'])
    render(<AnimationsPanel />)
    await waitFor(() => expect(screen.getByText('Animation')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Jouer sur le personnage' }))

    expect(blocksOf()).toHaveLength(1)
    expect(useSceneViews.getState().views[DOCUMENT]?.preview).toMatchObject({ nodeId: 'perso' })
  })

  it('takes the block back off when the same row is pressed again', async () => {
    withCharacter(['NlaTrack'])
    render(<AnimationsPanel />)
    await waitFor(() => expect(screen.getByText('Animation')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Jouer sur le personnage' }))
    await userEvent.click(screen.getByRole('button', { name: 'Arrêter et retirer le bloc' }))

    expect(blocksOf()).toEqual([])
    expect(useSceneViews.getState().views[DOCUMENT]?.preview).toBeNull()
  })

  // Two blocks left standing would play at once on one character, which is not what pressing a
  // second row asks for.
  it('never leaves two previews on the character', async () => {
    withCharacter(['NlaTrack', 'run'])
    render(<AnimationsPanel />)
    await waitFor(() => expect(screen.getByText('run')).toBeInTheDocument())

    const buttons = screen.getAllByRole('button', { name: 'Jouer sur le personnage' })
    await userEvent.click(buttons[0] as HTMLElement)
    await userEvent.click(screen.getByRole('button', { name: 'Jouer sur le personnage' }))

    expect(blocksOf()).toHaveLength(1)
  })

  // The one subtlety of this button: a try the playhead interrupted is kept WORK, so the next row
  // lays a second block IN ADDITION rather than taking the first back.
  it('keeps the block the playhead interrupted, and lays the next one in addition', async () => {
    withCharacter(['NlaTrack', 'run'])
    render(<AnimationsPanel />)
    await waitFor(() => expect(screen.getByText('run')).toBeInTheDocument())

    await userEvent.click(screen.getAllByRole('button', { name: 'Jouer sur le personnage' })[0]!)
    act(() => useSceneViews.getState().setPlaying(DOCUMENT, true))
    await userEvent.click(screen.getAllByRole('button', { name: 'Jouer sur le personnage' })[1]!)

    expect(blocksOf().map(clip => clip.source)).toEqual([
      { kind: 'embedded', name: 'NlaTrack' },
      { kind: 'embedded', name: 'run' },
    ])
  })

  // Off the character it went ON, which the block id alone does not say: taking it off the one in
  // FRONT left the first standing and the second laid, which is the two this button forbids.
  it('takes the block off the character it was laid on, not the one in front', async () => {
    const one = modelNodeFixture('perso')
    const two = modelNodeFixture('perso-2')
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [one, two], selectedIds: [one.id] })
    useModelClips.getState().report(DOCUMENT, one.id, ['NlaTrack'])
    useModelClips.getState().report(DOCUMENT, two.id, ['NlaTrack'])
    render(<AnimationsPanel />)
    await waitFor(() => expect(screen.getByText('Animation')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Jouer sur le personnage' }))
    act(() => selectIn(DOCUMENT, [two.id]))
    await userEvent.click(screen.getByRole('button', { name: 'Jouer sur le personnage' }))

    expect(blocksOf(one.id)).toEqual([])
    expect(blocksOf(two.id)).toHaveLength(1)
  })

  // Nothing to play it ON: the row is still listed, since a shipped animation is listed whatever
  // is in front, and the button says so rather than doing nothing.
  it('offers no preview while no character is in front', async () => {
    installFakeBridge({
      animations: { list: () => Promise.resolve([{ name: 'walk', thumbnail: false }]) },
    })
    render(<AnimationsPanel />)
    await waitFor(() => expect(screen.getByText('walk')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Jouer sur le personnage' })).toBeDisabled()
  })
})
