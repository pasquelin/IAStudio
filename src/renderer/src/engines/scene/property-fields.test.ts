import { MESH_ENTRIES, type GeometryDescriptor } from '@shared/domain/scene'
import { describe, expect, it } from 'vitest'
import { primitiveByKind } from './mesh-primitives'
import { lightByKind } from './light-types'
import {
  geometryFields,
  isVector3,
  lightFields,
  materialFields,
  withField,
} from './property-fields'
import { DEFAULT_MATERIAL } from './scene-state'

const names = (fields: { name: string }[]) => fields.map(field => field.name)

describe('geometryFields', () => {
  it('lists the parameters of the shape, and never its kind', () => {
    const fields = geometryFields({ kind: 'box', width: 1, height: 2, depth: 3 })

    expect(names(fields)).toEqual(['width', 'height', 'depth'])
    expect(fields[1]?.value).toBe(2)
  })

  // The panel is derived, never written per shape: a primitive with no fields would be a
  // primitive nobody can edit.
  it('describes every parameter of every buildable primitive', () => {
    for (const entry of MESH_ENTRIES) {
      const descriptor = primitiveByKind(entry.kind)?.create?.()
      if (!descriptor) continue

      const fields = geometryFields(descriptor)
      expect(fields.length).toBe(Object.keys(descriptor).length - 1)
      for (const field of fields) expect(field.spec).toBeDefined()
    }
  })

  it('gives segment counts a whole-number step', () => {
    const fields = geometryFields({
      kind: 'sphere',
      radius: 1,
      widthSegments: 32,
      heightSegments: 16,
    })

    expect(fields.find(field => field.name === 'widthSegments')?.spec).toMatchObject({
      control: 'number',
      step: 1,
    })
  })
})

describe('lightFields', () => {
  it('describes every parameter of every light', () => {
    for (const kind of ['ambient', 'directional', 'hemisphere', 'point', 'spot']) {
      const descriptor = lightByKind(kind)?.create()
      if (!descriptor) throw new Error(`no builder for ${kind}`)

      const fields = lightFields(descriptor)
      expect(fields.length).toBe(Object.keys(descriptor).length - 1)
      for (const field of fields) expect(field.spec).toBeDefined()
    }
  })

  it('reads a colour as a colour and a target as a vector', () => {
    const fields = lightFields({
      kind: 'directional',
      color: '#ffffff',
      intensity: 1,
      target: { x: 0, y: 0, z: 0 },
    })

    expect(fields.find(field => field.name === 'color')?.spec).toEqual({ control: 'color' })
    expect(fields.find(field => field.name === 'target')?.spec).toMatchObject({
      control: 'vector3',
    })
  })
})

describe('materialFields', () => {
  it('offers roughness and metalness as bounded values', () => {
    const fields = materialFields(DEFAULT_MATERIAL, '#868a91')

    expect(fields.find(field => field.name === 'roughness')?.spec).toEqual({
      control: 'slider',
      min: 0,
      max: 1,
      step: 0.01,
    })
  })

  // `null` means "the studio's own colour": the swatch shows what the viewport is painting
  // rather than disappearing.
  it('stands the viewport colour in for a material that carries none', () => {
    const fields = materialFields(DEFAULT_MATERIAL, '#868a91')

    expect(names(fields)).toEqual(['color', 'roughness', 'metalness'])
    expect(fields[0]?.value).toBe('#868a91')
  })

  it('keeps the colour a material does carry', () => {
    const fields = materialFields({ ...DEFAULT_MATERIAL, color: '#ff0000' }, '#868a91')

    expect(fields[0]?.value).toBe('#ff0000')
  })
})

describe('withField', () => {
  it('replaces one parameter and leaves the rest', () => {
    const box: GeometryDescriptor = { kind: 'box', width: 1, height: 2, depth: 3 }

    expect(withField(box, 'height', 9)).toEqual({ kind: 'box', width: 1, height: 9, depth: 3 })
  })

  it('does not touch the descriptor it was given', () => {
    const box: GeometryDescriptor = { kind: 'box', width: 1, height: 2, depth: 3 }
    withField(box, 'width', 5)

    expect(box.width).toBe(1)
  })
})

describe('isVector3', () => {
  it('recognises three numbered axes', () => {
    expect(isVector3({ x: 1, y: 2, z: 3 })).toBe(true)
  })

  it('refuses anything else', () => {
    expect(isVector3({ x: 1, y: 2 })).toBe(false)
    expect(isVector3({ x: '1', y: 2, z: 3 })).toBe(false)
    expect(isVector3(null)).toBe(false)
    expect(isVector3(4)).toBe(false)
  })
})
