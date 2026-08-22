import { render, screen } from '@testing-library/react'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { rigFit } from '@/engines/scene/rigFit'
import { modelNodeFixture, rigStateFixture, STANDING_BOUNDS } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type ModelNode } from '@/engines/scene/sceneState'
import { useModelClips } from '@/stores/modelClips'
import { installScene, sceneNodeIn, sceneNodeNow } from '@/stores/scene-fixtures'
import { useScenes } from '@/stores/scenes'
import { useSceneEdit } from '@/hooks/useSceneEdit'
import { installFakeBridge } from '@/services/fakeBridge'
import { useSettings } from '@/stores/settings'
import { useAssets } from '@/stores/assets'
import { useSceneViews } from '@/stores/sceneViews'
import type { FieldKind, ModelSummary } from '@shared/domain/model'
import type { PlanAccess } from '@shared/domain/plan'
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

/** The two clicks the offer takes: the dialogue opens, and the skeleton is laid from it. */
async function makeAnimatable(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Rendre animable' }))
  await userEvent.click(screen.getByRole('button', { name: 'Créer le squelette' }))
}

/** A model whose file has landed as a bare mesh of the given shape. */
function show(bounds = STANDING_BOUNDS, progress?: number): void {
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
    useAssets.setState({ items: [] })
    // Or a bone picked by one case decides what the next one draws, whatever it installs.
    useSceneViews.setState({ views: {} })
  })

  it('says nothing while the file has not landed', () => {
    render(<Host />)

    expect(screen.queryByText('Squelette')).not.toBeInTheDocument()
  })

  it('offers to make a bare mesh animatable', async () => {
    show()
    await makeAnimatable()

    expect(nodeOf()?.model.rig?.origin).toBe('local')
  })

  // Nothing is laid until the dialogue says so: the type of character and the service are read
  // there, and a click that rigged straight through would leave neither anything to answer.
  it('asks before it lays anything', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Rendre animable' }))

    expect(screen.getByLabelText('Type de personnage')).toBeInTheDocument()
    expect(nodeOf()?.model.rig).toBeUndefined()
  })

  // The studio's rigger fits a HUMANOID skeleton to a bounding box. Offering to lay one on a
  // horse would be a button that produces nonsense, so it says why instead.
  it('refuses to lay its own skeleton on something that is not humanoid', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Rendre animable' }))
    await userEvent.selectOptions(screen.getByLabelText('Type de personnage'), 'animal')

    expect(screen.getByText(/humanoïde/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer le squelette' })).toBeDisabled()
  })

  // Twenty-two bones carrying their humanoid roles: that is what makes retargeting possible
  // later, and the names are what a track addresses.
  it('writes a whole body, each bone named after the role it fills', async () => {
    show()
    await makeAnimatable()

    const bones = nodeOf()?.model.rig?.bones ?? []
    expect(bones).toHaveLength(22)
    expect(bones.every(bone => bone.name === bone.role)).toBe(true)
    expect(bones.map(bone => bone.name)).toContain('LeftHand')
  })

  it('undoes the whole thing, since the rig is a document edit like any other', async () => {
    show()
    await makeAnimatable()
    useScenes.getState().undo(DOCUMENT)

    expect(nodeOf()?.model.rig).toBeUndefined()
  })

  it('offers to take a skeleton back off once one is on', async () => {
    show()
    await makeAnimatable()
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

  /** The kind every rigger takes its character under — what carries the size limit. */
  const MESH_FIELD: FieldKind = 'mesh'

  const RIGGER: ModelSummary = {
    id: 'model_x',
    name: 'X',
    family: '3d',
    runsOn: SCENARIO_CLOUD,
    source: 'other',
    origin: 'official',
    featured: false,
    capabilities: ['3d23d'],
    tags: ['Rigging'],
  }

  /** The catalogue as it answers, and the plan a `cu-basic` account is on. */
  function withCatalogue(
    models: readonly Partial<ModelSummary>[],
    plan: PlanAccess | null,
    maxSize?: number,
  ): void {
    installFakeBridge({
      provider: {
        searchModels: () =>
          Promise.resolve({
            items: models.map(model => ({ ...RIGGER, ...model })),
            cursor: null,
          }),
        plan: () => Promise.resolve(plan),
        describeModel: () =>
          Promise.resolve({
            ...RIGGER,
            fields: [
              {
                key: 'characterFile',
                kind: MESH_FIELD,
                label: 'Character',
                required: true,
                ...(maxSize === undefined ? {} : { maxSize }),
              },
            ],
          }),
      },
    })
    useSettings.setState({ auth: { authenticated: true } })
  }

  // The refusal is said BEFORE any click, never discovered as a 403 — and it names the plan,
  // because « unavailable » without a reason is what sends someone hunting through settings.
  it('says why Scenario cannot rig this, without a click and without an attempt', async () => {
    withCatalogue([{ requiredPlanLevel: 50 }], { name: 'cu-basic', level: 25 })
    show()

    expect(await screen.findByText(/cu-basic/)).toBeInTheDocument()
  })

  it('says nothing when a service is within reach — the local rigger is the default anyway', async () => {
    withCatalogue([{ requiredPlanLevel: 50 }, { id: 'model_y' }], { name: 'cu-max', level: 100 })
    show()

    await screen.findByRole('button', { name: 'Rendre animable' })
    expect(screen.queryByText(/abonnement/)).not.toBeInTheDocument()
  })

  // The other refusal, and the one that costs minutes when it is heard too late: a plan that
  // allows the service still answers 413 above its limit, after the whole file has gone up.
  it('names the limit when the mesh is over it, plan or no plan', async () => {
    useAssets.setState({
      items: [
        {
          id: 'asset-1',
          name: 'giant',
          type: 'mesh',
          location: 'local',
          tags: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          bytes: 39_000_000,
        },
      ],
    })
    withCatalogue([{}], { name: 'cu-max', level: 100 }, 30_000_000)
    show()

    // 30 000 000 bytes, said the way every file manager on the desktop says them.
    expect(await screen.findByText(/29 Mio/)).toBeInTheDocument()
  })

  it('says nothing about a size while no service names a limit', async () => {
    useAssets.setState({
      items: [
        {
          id: 'asset-1',
          name: 'giant',
          type: 'mesh',
          location: 'local',
          tags: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          bytes: 39_000_000,
        },
      ],
    })
    withCatalogue([{}], { name: 'cu-max', level: 100 })
    show()

    await screen.findByRole('button', { name: 'Rendre animable' })
    expect(screen.queryByText(/limite/)).not.toBeInTheDocument()
  })

  // Offline, or not authenticated: an empty catalogue is not a subscription being short.
  it('says nothing when the catalogue answered no service at all', async () => {
    withCatalogue([{ tags: ['Remeshing'] }], { name: 'cu-basic', level: 25 })
    show()

    await screen.findByRole('button', { name: 'Rendre animable' })
    expect(screen.queryByText(/abonnement/)).not.toBeInTheDocument()
  })

  /** A model already rigged by the studio, with one of its bones picked in pose mode. */
  function rigged(bone?: string): void {
    const node = modelNodeFixture('a')
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [{ ...node, model: { ...node.model, rig: rigFit(STANDING_BOUNDS) } }],
    })
    useModelClips.setState({ rigs: { [DOCUMENT]: { a: rigStateFixture(['Hips', 'Spine']) } } })
    if (bone) useSceneViews.getState().setPickedBone(DOCUMENT, { nodeId: 'a', bone })
    render(<Host />)
  }

  it('lays the thirty finger bones on a rig that has none', async () => {
    rigged()
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter les mains' }))

    expect(nodeOf()?.model.rig?.bones).toHaveLength(22 + 30)
  })

  it('stops offering the hands once they are there', async () => {
    rigged()
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter les mains' }))

    expect(screen.queryByRole('button', { name: 'Ajouter les mains' })).not.toBeInTheDocument()
  })

  // The bone editing follows the pose mode's own pick: an inspector showing one node must not
  // edit the skeleton of another.
  it('offers nothing on a bone until one is picked', () => {
    rigged()

    expect(screen.queryByRole('button', { name: 'Retirer cet os' })).not.toBeInTheDocument()
  })

  it('gives the picked bone a role of the standard', async () => {
    rigged('Spine')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Articulation' }), 'Chest')

    const spine = nodeOf()?.model.rig?.bones.find(bone => bone.name === 'Spine')
    expect(spine?.role).toBe('Chest')
  })

  it('hangs a child under the picked bone, and takes a bone out', async () => {
    rigged('Spine')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un os enfant' }))
    expect(nodeOf()?.model.rig?.bones.some(bone => bone.parent === 'Spine')).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Retirer cet os' }))
    expect(nodeOf()?.model.rig?.bones.some(bone => bone.name === 'Spine')).toBe(false)
  })

  it('gives a joint a handle to reach for, and takes it back with its bone', async () => {
    rigged('LeftHand')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une poignée à suivre' }))

    expect(nodeOf()?.model.rig?.ik?.[0]).toMatchObject({ effector: 'LeftHand' })

    await userEvent.click(screen.getByRole('button', { name: 'Retirer la poignée' }))
    expect(nodeOf()?.model.rig?.ik).toEqual([])
    expect(nodeOf()?.model.rig?.bones.map(bone => bone.name)).not.toContain('LeftHand.handle')
  })

  // Every one of them answers 403 on this account, and submitting one needs the whole
  // export-upload-job-import chain: they are shown with the reason rather than left out.
  it('lists the Scenario services in the dialogue without letting one be chosen', async () => {
    withCatalogue([{ requiredPlanLevel: 50 }], { name: 'cu-basic', level: 25 })
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Rendre animable' }))

    const services = await screen.findByLabelText('Service')
    expect(services).toHaveValue('')
    expect([...services.querySelectorAll('option')].filter(option => option.disabled)).toHaveLength(
      1,
    )
  })

  // Written, tested and called by nothing until now. A rig arrives with the names its file
  // spells, and the pick has to follow the rename or every control below it goes grey.
  it('renames the picked bone, and keeps it picked under its new name', async () => {
    rigged('Spine')

    await userEvent.clear(screen.getByLabelText('Nom'))
    await userEvent.type(screen.getByLabelText('Nom'), 'Torso{Enter}')

    expect(nodeOf()?.model.rig?.bones.map(bone => bone.name)).toContain('Torso')
    expect(useSceneViews.getState().views[DOCUMENT]?.pickedBone?.bone).toBe('Torso')
  })

  // `renameRigBone` writes nothing for a name already taken, and the pick would then follow a
  // rename that never happened.
  it('refuses a name another bone already answers to', async () => {
    rigged('Spine')

    await userEvent.clear(screen.getByLabelText('Nom'))
    await userEvent.type(screen.getByLabelText('Nom'), 'Hips{Enter}')

    expect(nodeOf()?.model.rig?.bones.filter(bone => bone.name === 'Hips')).toHaveLength(1)
    expect(useSceneViews.getState().views[DOCUMENT]?.pickedBone?.bone).toBe('Spine')
  })

  it('never tells a model it cannot be rigged once it has been', () => {
    const node = modelNodeFixture('a')
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [{ ...node, model: { ...node.model, rig: rigFit(STANDING_BOUNDS) } }],
    })
    useModelClips.setState({ rigs: { [DOCUMENT]: { a: rigStateFixture(['Hips', 'Spine']) } } })
    render(<Host />)

    expect(screen.getByText(/a reçu un squelette/)).toBeInTheDocument()
    expect(screen.queryByText(/trop plat/)).not.toBeInTheDocument()
  })
})
