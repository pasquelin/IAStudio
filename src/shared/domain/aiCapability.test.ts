import { describe, expect, it } from 'vitest'
import { contractOf, reachableFrom, rolesWithContract, type AvailableInput } from './aiCapability'
import { aiRoleId, allRoles, ASSISTANT_ROLE, isGenerationRole } from './aiRole'

/** The contract of an employment, or a failure naming it — so a missing one reads as itself. */
const contract = (family: Parameters<typeof aiRoleId>[0], capability: string) => {
  const held = contractOf(aiRoleId(family, capability))
  if (!held) throw new Error(`no contract for ${family}/${capability}`)
  return held
}

describe('the contract of an employment', () => {
  /**
   * A role with no contract is an operation the panel can offer and never resolve: it would show
   * the models, take a prompt, and have nothing to say about what the model needs.
   */
  it('answers for every generation role, and for no other', () => {
    const generation = allRoles().filter(isGenerationRole)

    expect([...rolesWithContract()].sort()).toEqual([...generation].sort())
    expect(contractOf(ASSISTANT_ROLE)).toBeNull()
  })

  it('produces the kind its family is filed under, or the kind the employment makes', () => {
    expect(contract('image', 'txt2img').output).toBe('image')
    expect(contract('3d', 'img23d').output).toBe('mesh')
    expect(contract('material', 'txt2img_texture').output).toBe('image')
    // The one employment of the 3D family that does not answer with a mesh.
    expect(contract('3d', 'motion').output).toBe('animation')
    // The three the canvas edits reach for: their family names the treatment, not the output.
    expect(contract('upscale', 'upscale').output).toBe('image')
    expect(contract('vectorization', 'vectorize').output).toBe('image')
  })

  it('names what each employment starts from', () => {
    expect(contract('image', 'txt2img').inputs.map(input => input.role)).toEqual(['prompt'])
    expect(contract('image', 'img2img').inputs.map(input => input.role)).toEqual([
      'prompt',
      'source',
    ])
    expect(contract('image', 'inpaint').inputs.map(input => input.role)).toEqual([
      'prompt',
      'source',
      'mask',
    ])
  })

  /**
   * What tells the three image employments apart is the mask, not the model: the same weights
   * serve all of them (`ssd-1b` declares four capabilities and one download). An optional mask
   * would make `inpaint` indistinguishable from `img2img`, and the panel would offer two
   * operations that ask for exactly the same thing.
   */
  it('holds the mask to be what makes a retouch one', () => {
    const mask = contract('image', 'inpaint').inputs.find(input => input.role === 'mask')

    expect(mask?.required).toBe(true)
    expect(contract('image', 'img2img').inputs.some(input => input.role === 'mask')).toBe(false)
  })

  // Measured against `localFields.ts`, whose `mesh` template declares `{ ...PROMPT, required:
  // false }`: a picture already says what to make, and words are what one adds to steer it.
  it('leaves the prompt optional where a source already says what to make', () => {
    const prompt = contract('3d', 'img23d').inputs.find(input => input.role === 'prompt')

    expect(prompt?.required).toBe(false)
  })

  // Nothing describes a rig or an upscale: an empty box above them would read as a parameter
  // that does nothing.
  it('asks for no words at all where nothing is described', () => {
    expect(contract('3d', 'rig').inputs.map(input => input.role)).toEqual(['source'])
    expect(contract('upscale', 'upscale').inputs.map(input => input.role)).toEqual(['source'])
  })

  it('takes several references where a model may be handed several', () => {
    const references = contract('image', 'reference').inputs.find(
      input => input.role === 'reference',
    )

    expect(references?.many).toBe(true)
  })
})

describe('reachableFrom', () => {
  const picture: AvailableInput = { role: 'source', kind: 'image' }
  const mesh: AvailableInput = { role: 'source', kind: 'mesh' }
  const mask: AvailableInput = { role: 'mask', kind: 'image' }

  /**
   * The words are never counted: a prompt is typed, not selected. Counting one would make
   * text-to-image unreachable from an empty workspace, which is where every session starts.
   */
  it('reaches an employment that only asks for words, from nothing at all', () => {
    expect(reachableFrom(contract('image', 'txt2img'), [])).toBe(true)
    expect(reachableFrom(contract('3d', 'txt23d'), [])).toBe(true)
  })

  it('reaches an employment whose every required asset is at hand', () => {
    expect(reachableFrom(contract('image', 'img2img'), [picture])).toBe(true)
    expect(reachableFrom(contract('3d', 'img23d'), [picture])).toBe(true)
    expect(reachableFrom(contract('3d', 'rig'), [mesh])).toBe(true)
  })

  /**
   * 🛑 The panel must never offer an operation it cannot run: turning a picture into a mesh and
   * the mesh into what was asked for is a pipeline nobody implemented, and inventing it silently
   * is what ADR-23 forbids.
   */
  it('refuses an employment whose required asset is of another kind', () => {
    expect(reachableFrom(contract('3d', '3d23d'), [picture])).toBe(false)
    expect(reachableFrom(contract('image', 'img2img'), [mesh])).toBe(false)
    expect(reachableFrom(contract('video', 'video2video'), [picture])).toBe(false)
  })

  // A motion asks for words and takes a mesh if there is one.
  it('ignores what is only optional', () => {
    expect(reachableFrom(contract('3d', 'motion'), [])).toBe(true)
  })

  /**
   * 🛑 The reason the role is carried rather than deduced: a mask and the picture it masks are
   * both `image`. Judged on kinds alone, one selected picture made a retouch look reachable —
   * and running it would have repainted the whole canvas instead of the region.
   */
  it('refuses a retouch until a mask is there too, not just a second picture', () => {
    expect(reachableFrom(contract('image', 'inpaint'), [picture])).toBe(false)
    expect(reachableFrom(contract('image', 'inpaint'), [picture, picture])).toBe(false)
    expect(reachableFrom(contract('image', 'inpaint'), [picture, mask])).toBe(true)
  })

  // The two differ in what the model does with the picture, never in where it came from.
  it('lets a source stand in for a reference', () => {
    expect(reachableFrom(contract('image', 'reference'), [picture])).toBe(true)
  })
})
