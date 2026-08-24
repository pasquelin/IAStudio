import { describe, expect, it } from 'vitest'
import type { AvailableInput } from '@shared/domain/aiCapability'
import { aiRoleId } from '@shared/domain/aiRole'
import { resolveCapability } from './capabilityResolver'

const picture: AvailableInput = { role: 'source', kind: 'image' }
const mask: AvailableInput = { role: 'mask', kind: 'image' }
const mesh: AvailableInput = { role: 'source', kind: 'mesh' }
const clip: AvailableInput = { role: 'source', kind: 'video' }

describe('what the context points at', () => {
  /**
   * The § 7 of the brief, read in one line: nobody should have to know what `img2img` means, and
   * the operation follows from what is at hand.
   */
  it('reads an empty workspace as generating from words', () => {
    expect(resolveCapability('image', []).chosen).toBe(aiRoleId('image', 'txt2img'))
    expect(resolveCapability('3d', []).chosen).toBe(aiRoleId('3d', 'txt23d'))
  })

  it('reads a selected picture as working from it', () => {
    expect(resolveCapability('image', [picture]).chosen).toBe(aiRoleId('image', 'img2img'))
    expect(resolveCapability('3d', [picture]).chosen).toBe(aiRoleId('3d', 'img23d'))
    expect(resolveCapability('video', [picture]).chosen).toBe(aiRoleId('video', 'img2video'))
  })

  // The employment that USES the most of what is there: a mask is what makes a retouch one.
  it('reads a picture with a mask as a retouch', () => {
    expect(resolveCapability('image', [picture, mask]).chosen).toBe(aiRoleId('image', 'inpaint'))
  })

  it('reads a selected mesh as reworking it', () => {
    expect(resolveCapability('3d', [mesh]).chosen).toBe(aiRoleId('3d', '3d23d'))
  })

  it('reads a selected clip as reworking it', () => {
    expect(resolveCapability('video', [clip]).chosen).toBe(aiRoleId('video', 'video2video'))
  })
})

describe('what the context could point at instead', () => {
  /**
   * 🛑 The one thing ADR-23 forbids: turning a picture into a mesh so that a mesh-to-mesh becomes
   * possible is a pipeline nobody implemented. An unreachable employment is not offered at all.
   */
  it('offers no employment the context cannot reach', () => {
    const { reachable } = resolveCapability('3d', [picture])

    expect(reachable).toContain(aiRoleId('3d', 'img23d'))
    expect(reachable).not.toContain(aiRoleId('3d', '3d23d'))
    expect(reachable).not.toContain(aiRoleId('3d', 'rig'))
  })

  it('offers every employment a mesh unlocks, the rig included', () => {
    const { reachable } = resolveCapability('3d', [mesh])

    expect(reachable).toContain(aiRoleId('3d', '3d23d'))
    expect(reachable).toContain(aiRoleId('3d', 'rig'))
    // Words alone are always reachable: a prompt is typed, not selected.
    expect(reachable).toContain(aiRoleId('3d', 'txt23d'))
  })

  it('offers a retouch only once the mask is there', () => {
    expect(resolveCapability('image', [picture]).reachable).not.toContain(
      aiRoleId('image', 'inpaint'),
    )
    expect(resolveCapability('image', [picture, mask]).reachable).toContain(
      aiRoleId('image', 'inpaint'),
    )
  })

  // A rig is asked for by name: a mesh alone reads as reworking it, which is the common gesture.
  it('keeps the rig out of the suggestion, offering it all the same', () => {
    const { chosen, reachable } = resolveCapability('3d', [mesh])

    expect(chosen).not.toBe(aiRoleId('3d', 'rig'))
    expect(reachable).toContain(aiRoleId('3d', 'rig'))
  })
})

describe('an operation the person asked for', () => {
  /**
   * § 21: a selection changing under their hand must not take the operation away from them, and
   * the prompt they were writing must not go with it.
   */
  it('wins over what the context would have suggested', () => {
    const forced = aiRoleId('image', 'controlnet')
    const { chosen, forced: held } = resolveCapability('image', [picture], forced)

    expect(chosen).toBe(forced)
    expect(held).toBe(true)
  })

  /**
   * 🛑 It survives losing its inputs, and that is the point: an edit forces an employment AND
   * fills its form — the flattened picture is uploaded into the preset, where the context cannot
   * see it. Dropping it for being unreachable threw away the generation just prepared.
   */
  it('holds even where the context alone could not reach it', () => {
    const forced = aiRoleId('image', 'img2img')
    const { chosen, reachable } = resolveCapability('image', [], forced)

    expect(chosen).toBe(forced)
    expect(reachable).not.toContain(forced)
  })

  // A name no family declares has no contract, so there is nothing to honour.
  it('falls back to the context for an employment of another family', () => {
    const { chosen, forced } = resolveCapability('image', [], aiRoleId('3d', 'txt23d'))

    expect(chosen).toBe(aiRoleId('image', 'txt2img'))
    expect(forced).toBe(false)
  })
})

/**
 * `other` declares no capability at all, so it can be served by nothing. The panel says so
 * rather than drawing a form whose button is dead.
 */
it('answers nothing for a family that generates nothing', () => {
  expect(resolveCapability('other', [picture])).toEqual({
    chosen: null,
    reachable: [],
    forced: false,
  })
})
