import { describe, expect, it } from 'vitest'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { createCredentialsWatch } from './credentialsWatch'
import { createOwnerScope } from './ownerScope'

function cloudAsset(ownerId: string): CloudAsset {
  return {
    id: 'asset_1',
    name: 'Boulder',
    type: 'image',
    remoteType: 'txt2img',
    ownerId,
    createdAt: '2026-08-06T10:00:00.000Z',
    updatedAt: '2026-08-06T10:00:00.000Z',
    privacy: 'private',
    tags: [],
    collectionIds: [],
  }
}

describe('which project the key opens onto', () => {
  it('knows nothing before the library has answered once', () => {
    const scope = createOwnerScope(createCredentialsWatch().watch)
    expect(scope.current()).toBeNull()
  })

  it('learns it from the first asset that names one', () => {
    const scope = createOwnerScope(createCredentialsWatch().watch)
    scope.observe([cloudAsset('proj_a')])

    expect(scope.current()).toBe('proj_a')
  })

  it('ignores an asset that names none rather than recording an empty project', () => {
    const scope = createOwnerScope(createCredentialsWatch().watch)
    scope.observe([cloudAsset('')])

    expect(scope.current()).toBeNull()
  })

  it('keeps the first answer rather than following each page', () => {
    const scope = createOwnerScope(createCredentialsWatch().watch)
    scope.observe([cloudAsset('proj_a')])
    scope.observe([cloudAsset('proj_b')])

    expect(scope.current()).toBe('proj_a')
  })

  it('forgets it when the credentials change, since it belonged to the old key', () => {
    const credentials = createCredentialsWatch()
    const scope = createOwnerScope(credentials.watch)
    scope.observe([cloudAsset('proj_a')])

    credentials.changed()

    expect(scope.current()).toBeNull()
  })

  it('learns the new project once the new key has answered', () => {
    const credentials = createCredentialsWatch()
    const scope = createOwnerScope(credentials.watch)
    scope.observe([cloudAsset('proj_a')])
    credentials.changed()
    scope.observe([cloudAsset('proj_b')])

    expect(scope.current()).toBe('proj_b')
  })
})
