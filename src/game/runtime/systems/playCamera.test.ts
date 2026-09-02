// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { newComponent } from '@shared/domain/componentRegistry'
import { DEFAULT_PLAY, type PlayCamera } from '@shared/domain/scene'
import type { CameraView } from '../../ports/renderPort'
import { createCharacters } from '../characters'
import { createPilots } from '../pilots'
import { restingTransform } from '../entity'
import { testPorts, testWorld } from '../world-fixtures'
import { createPlayCameraSystem } from './playCamera'

function watching(camera: PlayCamera, controlled = true) {
  const views: (CameraView | null)[] = []
  const characters = createCharacters()
  const world = testWorld({
    play: { ...DEFAULT_PLAY, camera },
    ports: testPorts({
      render: { place: () => {}, view: view => views.push(view), veil: () => {} },
    }),
    systems: [createPlayCameraSystem({ characters, pilots: createPilots() })],
  })
  if (controlled) {
    world.entities.add({
      id: 'hero',
      name: 'hero',
      transform: restingTransform(),
      components: [newComponent('CharacterController')],
    })
  }

  // Through the character system's own sweep: the camera watches whoever it named first.
  characters.intents(world, 1 / 60)
  return { world, views }
}

describe('the camera rank of a running game', () => {
  it('watches the character from its eyes, measured up from its feet', () => {
    const { world, views } = watching('firstPerson')

    world.lateUpdate(0)

    // A 1,8 capsule standing at the origin has its feet at −0,9.
    expect(views[0]?.position.y).toBeCloseTo(-0.9 + DEFAULT_PLAY.eyeHeight, 6)
  })

  /** A set flown by hand: writing the camera would fight whoever is dragging it. */
  it('leaves an orbited set alone', () => {
    const { world, views } = watching('orbit')

    world.lateUpdate(0)

    expect(views).toEqual([null])
  })

  it('says nothing at all about a scene nobody walks', () => {
    const { world, views } = watching('firstPerson', false)

    world.lateUpdate(0)

    expect(views).toEqual([])
  })
})
