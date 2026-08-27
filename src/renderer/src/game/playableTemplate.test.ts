import { describe, expect, it } from 'vitest'
import { TEMPLATES_BY_GROUP, type SceneTemplateId } from '@shared/domain/sceneTemplate'
import { createExportHost } from '@game/host/exportHost'
import { notedPhysics } from '@game/physics/physics-fixtures'
import type { CameraView } from '@game/ports/renderPort'
import { sceneFromTemplate } from '@/engines/scene/sceneTemplates'
import { worldFromScene } from './worldFromScene'

const STEP = 1 / 60

/** The document a person gets from « Nouveau document », run as the game it claims to be. */
function played(id: SceneTemplateId) {
  const views: (CameraView | null)[] = []
  const physics = notedPhysics()
  const world = worldFromScene('doc-1', sceneFromTemplate(id), {
    ...createExportHost({
      input: new EventTarget(),
      player: { id: 'p1', name: 'Alba', local: true },
      files: {},
    }),
    physics,
    render: { place: () => {}, view: view => views.push(view), veil: () => {} },
  })

  world.step(STEP)
  world.lateUpdate(0)
  return { views, bodies: physics.added ?? [] }
}

/**
 * 🛑 Read off the play CAMERA rather than off the components: the camera system says nothing at
 * all about a scene nobody walks, so a view landing here is the whole chain answering.
 */
describe('what « Nouveau document ▸ Third Person » opens on', () => {
  it.each(TEMPLATES_BY_GROUP.character)('gives %s a game somebody walks', id => {
    // The LENGTH first: a scene nobody walks is answered with no view at all, and `views[0]`
    // would then be `undefined` — which is not null either.
    const { views, bodies } = played(id)

    expect(views).toHaveLength(1)
    expect(views[0]).not.toBeNull()
    // 🛑 And something to stand ON: the camera system answers for anyone carrying a controller,
    // floor or no floor — measured, the three templates handed the physics one body, the walker.
    expect(bodies.filter(one => one.kind === 'fixed').length).toBeGreaterThan(0)
  })

  it('pulls whoever walks it down, which is what makes a floor mean anything', () => {
    for (const id of TEMPLATES_BY_GROUP.character) {
      expect(sceneFromTemplate(id).world.play.gravity).toBeGreaterThan(0)
    }
  })

  /** The general ones are sets, not games — and none of them claims otherwise. */
  it.each(TEMPLATES_BY_GROUP.general)('leaves %s a set nobody is walked in', id => {
    expect(sceneFromTemplate(id).nodes.flatMap(node => node.components ?? [])).toEqual([])
  })
})
