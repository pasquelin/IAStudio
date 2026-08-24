import { describe, expect, it } from 'vitest'
import type { AiOverview, ModelCandidate, RoleRow } from '@shared/domain/aiOverview'
import { aiRoleId, ASSISTANT_ROLE, DICTATION_ROLE } from '@shared/domain/aiRole'
import { GIBI, localModel } from '@shared/domain/localModel-fixtures'
import { cloudIdsOf, employmentGroupsOf, localStandingOf } from './inventory'

const candidate = (over: Partial<ModelCandidate> = {}): ModelCandidate => ({
  model: localModel(),
  installed: true,
  loaded: false,
  holdable: true,
  unverified: false,
  supplied: false,
  serves: 1,
  fit: 'compatible',
  obstacle: null,
  ...over,
})

const row = (over: Partial<RoleRow> = {}): RoleRow => ({
  role: DICTATION_ROLE,
  provider: null,
  chosen: { app: null, project: null },
  candidates: [],
  clouds: [],
  ...over,
})

const overview = (roles: readonly RoleRow[]): AiOverview => ({
  roles,
  machine: {
    physicalBytes: 96 * GIBI,
    availableBytes: 34 * GIBI,
    diskFreeBytes: 500 * GIBI,
    gpu: null,
    vram: null,
  },
  projectPath: null,
  installing: null,
  loading: null,
  loadFailure: null,
  installFailure: null,
  ollama: { ready: false, installed: false, names: [], progress: null, failed: false },
})

describe('what the machine holds', () => {
  it('sorts the catalogue into installed, offered and out of reach', () => {
    const standing = localStandingOf(
      overview([
        row({
          candidates: [
            candidate({ model: localModel({ id: 'a' }), installed: true, loaded: true }),
            candidate({ model: localModel({ id: 'b' }), installed: false }),
            candidate({ model: localModel({ id: 'c' }), installed: false, fit: 'incompatible' }),
          ],
        }),
      ]),
    )

    expect(standing).toEqual({
      installed: 1,
      installedBytes: GIBI,
      loaded: 1,
      offered: 1,
      outOfReach: 1,
    })
  })

  /**
   * The overview is keyed by EMPLOYMENT and one download answers up to six of them. Walked flat,
   * SSD-1B was counted six times and its 4.47 GB with it — the whole reason this is a map.
   */
  it('counts one model once, however many employments it answers', () => {
    const both = [candidate({ model: localModel({ id: 'ssd', diskBytes: 4 * GIBI }) })]
    const standing = localStandingOf(
      overview([
        row({ role: aiRoleId('image', 'txt2img'), candidates: both }),
        row({ role: aiRoleId('image', 'inpaint'), candidates: both }),
      ]),
    )

    expect(standing.installed).toBe(1)
    expect(standing.installedBytes).toBe(4 * GIBI)
  })

  // `unknown` is what a machine with no runtime to ask answers, and it is not a refusal.
  it('leaves an unmeasured model among the ones it offers', () => {
    const standing = localStandingOf(
      overview([row({ candidates: [candidate({ installed: false, fit: 'unknown' })] })]),
    )

    expect(standing.offered).toBe(1)
    expect(standing.outOfReach).toBe(0)
  })
})

describe('the clouds behind an account', () => {
  it('lists each once, in the registry order rather than the rows order', () => {
    expect(
      cloudIdsOf(
        overview([row({ clouds: ['anthropic', 'scenario'] }), row({ clouds: ['scenario'] })]),
      ),
    ).toEqual(['scenario', 'anthropic'])
  })

  it('answers nothing where no key is held', () => {
    expect(cloudIdsOf(overview([row()]))).toEqual([])
  })
})

describe('the employments', () => {
  it('gathers a family into one line and counts what is served', () => {
    const [group] = employmentGroupsOf(
      overview([
        row({
          role: aiRoleId('image', 'txt2img'),
          provider: { kind: 'cloud', providerId: 'scenario' },
        }),
        row({ role: aiRoleId('image', 'inpaint') }),
      ]),
    )

    expect(group).toMatchObject({ key: 'image', family: 'image', served: 1, total: 2 })
    // Several employments: naming the first one's provider would read as an answer about both.
    expect(group?.sole).toBeNull()
  })

  it('keeps the row itself where a group holds one employment, so it can be named', () => {
    const [group] = employmentGroupsOf(overview([row({ role: aiRoleId('upscale', 'upscale') })]))

    expect(group?.sole?.role).toBe(aiRoleId('upscale', 'upscale'))
  })

  it('puts the two roles no family holds after the families', () => {
    const groups = employmentGroupsOf(
      overview([
        row({ role: ASSISTANT_ROLE }),
        row({ role: aiRoleId('image', 'txt2img') }),
        row({ role: DICTATION_ROLE }),
      ]),
    )

    expect(groups.map(group => group.key)).toEqual(['image', ASSISTANT_ROLE, DICTATION_ROLE])
    // No family: it is what sends the line to the manager rather than to a family's screen.
    expect(groups.at(-1)?.family).toBeNull()
  })

  /**
   * The main process already drops the roles nothing could serve. Counting those in would tell
   * someone with a full machine that they are a third of the way there.
   */
  it('names no family the overview said nothing about', () => {
    expect(employmentGroupsOf(overview([]))).toEqual([])
  })
})
