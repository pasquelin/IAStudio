import { describe, expect, it } from 'vitest'
import type { AiOverview, ModelCandidate, RoleRow } from '@shared/domain/aiOverview'
import { aiRoleId, ASSISTANT_ROLE, DICTATION_ROLE } from '@shared/domain/aiRole'
import { GIBI, localModel } from '@shared/domain/localModel-fixtures'
import {
  adviceOf,
  cloudIdsOf,
  coverageOf,
  employmentGroupsOf,
  localStandingOf,
  servedTotalsOf,
} from './inventory'

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

describe('what one download covers', () => {
  const wide = candidate({
    model: localModel({ id: 'ssd-1b', name: 'SSD-1B', diskBytes: 4 * GIBI }),
    installed: false,
    serves: 6,
  })
  const narrow = candidate({
    model: localModel({ id: 'mochi', name: 'Mochi', diskBytes: 133 * GIBI }),
    installed: false,
    serves: 1,
  })

  const spread = (): AiOverview =>
    overview([
      row({ role: aiRoleId('image', 'txt2img'), candidates: [wide, narrow] }),
      row({ role: aiRoleId('texture', 'txt2img_texture'), candidates: [wide] }),
    ])

  it('ranks by employments answered, not by what a model weighs', () => {
    expect(coverageOf(spread(), 2).map(one => one.id)).toEqual(['ssd-1b', 'mochi'])
  })

  /**
   * The whole point of the block: a model filed under Image that also serves Texture is what
   * makes one download worth two, and its own `family` field names only where its card is filed.
   */
  it('names the families a model spans, read off the rows it is a candidate of', () => {
    expect(coverageOf(spread(), 1)[0]?.families).toEqual(['image', 'texture'])
  })

  it('gives a tie to the lighter one', () => {
    const heavy = candidate({
      model: localModel({ id: 'heavy', diskBytes: 40 * GIBI }),
      serves: 2,
    })
    const light = candidate({ model: localModel({ id: 'light', diskBytes: GIBI }), serves: 2 })

    expect(
      coverageOf(overview([row({ candidates: [heavy, light] })]), 2).map(one => one.id),
    ).toEqual(['light', 'heavy'])
  })

  it('keeps what this machine cannot hold, marked rather than dropped', () => {
    const beyond = candidate({ installed: false, fit: 'insufficient-memory' })

    expect(coverageOf(overview([row({ candidates: [beyond] })]), 3)[0]?.usable).toBe(false)
  })
})

describe('the advice', () => {
  it('names choosing before installing: what is on the disk costs nothing', () => {
    const installed = candidate({ installed: true, serves: 1 })
    const offered = candidate({
      model: localModel({ id: 'wide', name: 'Wide' }),
      installed: false,
      serves: 6,
    })

    const said = adviceOf(
      overview([
        row({ role: aiRoleId('image', 'txt2img'), provider: null, candidates: [installed] }),
        row({ role: aiRoleId('video', 'txt2video'), candidates: [offered] }),
      ]),
      ['scenario'],
    )

    expect(said.map(one => one.kind)).toEqual(['choose', 'install'])
    // The roles themselves, not their count: a reader cannot act on « 2 operations ».
    expect(said[0]).toMatchObject({ roles: [aiRoleId('image', 'txt2img')] })
  })

  it('offers a key only where no account is held at all', () => {
    expect(adviceOf(overview([]), []).map(one => one.kind)).toEqual(['key'])
    expect(adviceOf(overview([]), ['scenario'])).toEqual([])
  })

  /** A model this machine cannot run is not advice, it is a disappointment. */
  it('never advises installing what the machine could not hold', () => {
    const beyond = candidate({ installed: false, fit: 'incompatible', serves: 9 })

    expect(adviceOf(overview([row({ candidates: [beyond] })]), ['scenario'])).toEqual([])
  })

  it('says at most two things, so the line stays a line', () => {
    const idle = candidate({ installed: true })
    const offered = candidate({ model: localModel({ id: 'wide' }), installed: false, serves: 4 })

    expect(adviceOf(overview([row({ candidates: [idle, offered] })]), []).length).toBe(2)
  })
})

describe('where the studio stands', () => {
  it('adds up every employment and the ones that are served', () => {
    const totals = servedTotalsOf(
      overview([
        row({
          role: aiRoleId('image', 'txt2img'),
          provider: { kind: 'cloud', providerId: 'scenario' },
        }),
        row({ role: aiRoleId('image', 'inpaint') }),
        row({ role: ASSISTANT_ROLE, provider: { kind: 'local', modelId: 'a' } }),
      ]),
    )

    expect(totals).toEqual({ served: 2, total: 3 })
  })

  /** Nothing to be a fraction of: the band must not divide by it. */
  it('answers zero over zero on an overview that offers nothing', () => {
    expect(servedTotalsOf(overview([]))).toEqual({ served: 0, total: 0 })
  })
})
