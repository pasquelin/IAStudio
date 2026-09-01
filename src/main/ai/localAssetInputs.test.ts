import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { createLocalAssetInputResolver } from './localAssetInputs'

const asset = (over: Partial<Asset> = {}): Asset => ({
  id: 'asset_one',
  name: 'a picture',
  type: 'image',
  location: 'local',
  path: 'assets/a-picture.png',
  tags: [],
  createdAt: '2026-08-22T10:00:00.000Z',
  ...over,
})

const resolverOf = (found: Asset | null, root: string | null = '/project') =>
  createLocalAssetInputResolver({ find: () => Promise.resolve(found), projectPath: () => root })

describe('the pictures a local generation is handed', () => {
  /** The file is already here: uploading it to run something that never leaves would be a
   * transfer nobody asked for, paid in the person's bandwidth. */
  it('answers where the file sits rather than an id the engine cannot open', async () => {
    const resolved = await resolverOf(asset()).resolveBody({ image: 'asset_one' })

    expect(resolved.image).toBe('/project/assets/a-picture.png')
  })

  it('reaches the pictures held in a list', async () => {
    const resolved = await resolverOf(asset()).resolveBody({ referenceImages: ['asset_one'] })

    expect(resolved.referenceImages).toEqual(['/project/assets/a-picture.png'])
  })

  it('leaves alone what is not an asset id at all', async () => {
    const resolved = await resolverOf(asset()).resolveBody({ prompt: 'a cat', steps: 8 })

    expect(resolved).toEqual({ prompt: 'a cat', steps: 8 })
  })

  /** The engine refuses what it cannot open and says so; a body silently missing its picture
   * generates something plausible and wrong. */
  it('leaves an id no row answers for as it stands', async () => {
    expect((await resolverOf(null).resolveBody({ image: 'asset_gone' })).image).toBe('asset_gone')
  })

  it('leaves an id alone while no project is open', async () => {
    const resolved = await resolverOf(asset(), null).resolveBody({ image: 'asset_one' })

    expect(resolved.image).toBe('asset_one')
  })

  // A catalogue row is DATA, and data is where a `../` comes from.
  it('refuses a path that climbs out of the project', async () => {
    const climbing = asset({ path: '../../.ssh/id_rsa' })

    expect((await resolverOf(climbing).resolveBody({ image: 'asset_one' })).image).toBe('asset_one')
  })
})
