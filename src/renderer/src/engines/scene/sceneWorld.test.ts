import { describe, expect, it } from 'vitest'
import { DEFAULT_WORLD, STUDIO_ENVIRONMENT } from '@shared/domain/scene'
import { backgroundOfKind, environmentOfKind, fogOfKind, readWorld } from './sceneWorld'

describe('reading a world back', () => {
  it('opens a document written before the world existed on the defaults', () => {
    expect(readWorld(undefined, undefined)).toEqual(DEFAULT_WORLD)
  })

  it('keeps the sky of a document that spelled it at the root', () => {
    // Every scene saved so far: `environment` beside `nodes`, with no `world` at all.
    const held = readWorld(undefined, { kind: 'skybox', assetId: 'sky-1' })

    expect(held.environment).toEqual({ kind: 'skybox', assetId: 'sky-1' })
    expect(held.exposure).toBe(DEFAULT_WORLD.exposure)
  })

  it('lets the nested sky win over the one at the root', () => {
    const held = readWorld({ environment: STUDIO_ENVIRONMENT }, { kind: 'skybox', assetId: 'old' })

    expect(held.environment).toEqual(STUDIO_ENVIRONMENT)
  })

  it('holds a hand-edited number to the bounds a slider offers', () => {
    expect(readWorld({ envIntensity: 900 }, undefined).envIntensity).toBe(3)
    expect(readWorld({ exposure: -4 }, undefined).exposure).toBe(0)
  })

  it('refuses a colour background with no colour rather than painting black', () => {
    expect(readWorld({ background: { kind: 'color' } }, undefined).background).toEqual({
      kind: 'environment',
      blur: 0,
    })
  })

  it('opens a backdrop written before the softening on a sharp one', () => {
    expect(readWorld({ background: { kind: 'environment' } }, undefined).background).toEqual({
      kind: 'environment',
      blur: 0,
    })
  })

  it('holds a hand-edited softening to what three.js actually takes', () => {
    expect(
      readWorld({ background: { kind: 'environment', blur: 40 } }, undefined).background,
    ).toEqual({ kind: 'environment', blur: 1 })
  })

  it('reads both forms of fog, and nothing else', () => {
    expect(
      readWorld({ fog: { kind: 'linear', color: '#fff', near: 1, far: 9 } }, undefined).fog,
    ).toEqual({ kind: 'linear', color: '#fff', near: 1, far: 9 })
    expect(
      readWorld({ fog: { kind: 'exp2', color: '#fff', density: 0.1 } }, undefined).fog,
    ).toEqual({ kind: 'exp2', color: '#fff', density: 0.1 })
    expect(readWorld({ fog: { kind: 'volumetric' } }, undefined).fog).toEqual({ kind: 'none' })
  })

  it('reads a tone mapping this build knows, and falls back on one it does not', () => {
    expect(readWorld({ toneMapping: 'reinhard' }, undefined).toneMapping).toBe('reinhard')
    expect(readWorld({ toneMapping: 'agx' }, undefined).toneMapping).toBe('none')
  })

  it('gives a ground with no colour the studio one rather than a string', () => {
    expect(readWorld({ ground: { visible: true } }, undefined).ground).toEqual({
      visible: true,
      color: null,
      size: 20,
      opacity: 1,
      receiveShadow: true,
    })
  })
})

describe('switching the form of a fog', () => {
  it('carries the colour across and nothing else', () => {
    const held = fogOfKind('exp2', { kind: 'linear', color: '#abcdef', near: 3, far: 7 })

    expect(held).toEqual({ kind: 'exp2', color: '#abcdef', density: 0.02 })
  })

  it('opens on something visible when turned on from nothing', () => {
    expect(fogOfKind('linear', { kind: 'none' })).toMatchObject({
      kind: 'linear',
      near: 10,
      far: 60,
    })
  })

  it('keeps no colour at all when turned off', () => {
    expect(fogOfKind('none', { kind: 'exp2', color: '#abcdef', density: 0.1 })).toEqual({
      kind: 'none',
    })
  })
})

describe('switching what lights a scene', () => {
  const skies = [{ id: 'sky-1' }, { id: 'sky-2' }]

  it('lights from the first sky of the project when one is asked for', () => {
    expect(environmentOfKind('skybox', skies)).toEqual({ kind: 'skybox', assetId: 'sky-1' })
  })

  // A sky is a REFERENCE: with none to point at, the answer is the studio rather than a link
  // to nothing.
  it('stays on the studio when the project holds no sky at all', () => {
    expect(environmentOfKind('skybox', [])).toEqual(STUDIO_ENVIRONMENT)
  })

  it('goes back to the studio whatever the project holds', () => {
    expect(environmentOfKind('studio', skies)).toEqual(STUDIO_ENVIRONMENT)
  })
})

describe('switching the form of a backdrop', () => {
  it('carries the colour across, so leaving and coming back keeps what was chosen', () => {
    const chosen = backgroundOfKind('color', { kind: 'environment', blur: 0 })
    const away = backgroundOfKind('transparent', chosen)

    expect(backgroundOfKind('color', away)).toEqual(chosen)
  })

  it('opens on a colour of its own when none was ever chosen', () => {
    expect(backgroundOfKind('color', { kind: 'environment', blur: 0 })).toMatchObject({
      kind: 'color',
    })
  })

  it('carries nothing back to the environment', () => {
    expect(backgroundOfKind('environment', { kind: 'color', color: '#123456' })).toEqual({
      kind: 'environment',
      blur: 0,
    })
  })
})
