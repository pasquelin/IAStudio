import { describe, expect, it } from 'vitest'
import {
  aiRoleId,
  allRoles,
  ASSISTANT_ROLE,
  DICTATION_ROLE,
  partsOfRole,
  providerFor,
  roleChoicesFor,
  type RoleChoices,
  type RoleOffer,
  type RoleProvider,
} from './aiRole'

const offer = (over: Partial<RoleOffer> = {}): RoleOffer => ({
  localModelIds: [],
  cloudIds: [],
  ...over,
})

/** A cloud, named by an id the way every one of them is — never by a member of the union. */
const CLOUD: RoleProvider = { kind: 'cloud', providerId: 'scenario' }

describe('aiRoleId', () => {
  it('names a capability of a family', () => {
    expect(aiRoleId('image', 'inpaint')).toBe('image/inpaint')
    expect(aiRoleId('video', 'img2video')).toBe('video/img2video')
  })

  // A role keys the stored preference: a name nobody serves would read as "no choice made" and
  // never redden, so it is refused where it is composed.
  it('refuses a capability the family does not have', () => {
    expect(() => aiRoleId('image', 'txt2video')).toThrow()
    expect(() => aiRoleId('video', 'inpaint')).toThrow()
    expect(() => aiRoleId('image', '')).toThrow()
  })
})

describe('allRoles', () => {
  // Derived from the capability table rather than listed: a family that gains a capability gains
  // its role, where a list written by hand would drift the day one is added.
  it('covers every capability of every family, plus the two standalone roles', () => {
    const roles = allRoles()

    expect(roles).toContain(ASSISTANT_ROLE)
    expect(roles).toContain(DICTATION_ROLE)
    expect(roles).toContain(aiRoleId('image', 'txt2img'))
    expect(roles).toContain(aiRoleId('audio', 'video2audio'))
    expect(new Set(roles).size).toBe(roles.length)
  })
})

describe('partsOfRole', () => {
  it('reads back what a generation role is made of', () => {
    expect(partsOfRole(aiRoleId('3d', 'img23d'))).toEqual({ family: '3d', capability: 'img23d' })
  })

  it('answers nothing for a role that is not a pair', () => {
    expect(partsOfRole(ASSISTANT_ROLE)).toBeNull()
    expect(partsOfRole(DICTATION_ROLE)).toBeNull()
  })
})

describe('roleChoicesFor', () => {
  const defaults: RoleChoices = { [ASSISTANT_ROLE]: CLOUD }
  const byProject: Record<string, RoleChoices> = { '/work/client': { [DICTATION_ROLE]: CLOUD } }

  it('stands on the default alone when no project is open', () => {
    expect(roleChoicesFor(defaults, byProject, null)).toEqual(defaults)
  })

  // Per ROLE: overriding one in a project must not reset the others to nothing.
  it('overlays what a project overrides without dropping the rest', () => {
    expect(roleChoicesFor(defaults, byProject, '/work/client')).toEqual({
      [ASSISTANT_ROLE]: CLOUD,
      [DICTATION_ROLE]: CLOUD,
    })
  })

  it('leaves the default alone for a project that overrides nothing', () => {
    expect(roleChoicesFor(defaults, byProject, '/work/other')).toEqual(defaults)
  })

  it('lets a project override a role the default already set', () => {
    const overriding: Record<string, RoleChoices> = {
      '/work/client': { [ASSISTANT_ROLE]: { kind: 'local', modelId: 'x' } },
    }

    expect(roleChoicesFor(defaults, overriding, '/work/client')).toEqual({
      [ASSISTANT_ROLE]: { kind: 'local', modelId: 'x' },
    })
  })
})

describe('providerFor', () => {
  const noChoice: RoleChoices = {}

  // ADR-21 § B: the application has to be useful with no account at all.
  it('serves a role locally when nothing was chosen and a model is there', () => {
    expect(providerFor(ASSISTANT_ROLE, noChoice, offer({ localModelIds: ['llama'] }))).toEqual({
      kind: 'local',
      modelId: 'llama',
    })
  })

  // A key present ADDS a provider to the choice; it does not take the lead.
  it('still prefers the local model when an account is also ready', () => {
    expect(
      providerFor(
        ASSISTANT_ROLE,
        noChoice,
        offer({ localModelIds: ['llama'], cloudIds: ['scenario'] }),
      ),
    ).toEqual({ kind: 'local', modelId: 'llama' })
  })

  it('falls back to a cloud when no local model serves the role', () => {
    expect(providerFor(ASSISTANT_ROLE, noChoice, offer({ cloudIds: ['scenario'] }))).toEqual(CLOUD)
  })

  // The role says so at its own place, instead of a global banner condemning the whole app.
  it('answers nothing when neither side can serve', () => {
    expect(providerFor(ASSISTANT_ROLE, noChoice, offer())).toBeNull()
  })

  it('honours an explicit choice over the default', () => {
    const chosen: RoleChoices = { [ASSISTANT_ROLE]: CLOUD }

    expect(
      providerFor(
        ASSISTANT_ROLE,
        chosen,
        offer({ localModelIds: ['llama'], cloudIds: ['scenario'] }),
      ),
    ).toEqual(CLOUD)
  })

  /**
   * A cloud is one entry of a list, never a member of the union: a choice pointing at one the
   * registry no longer holds falls back, the way a model uninstalled since does.
   */
  it('falls back from a cloud that is no longer offered', () => {
    const chosen: RoleChoices = { [ASSISTANT_ROLE]: { kind: 'cloud', providerId: 'gone' } }

    expect(providerFor(ASSISTANT_ROLE, chosen, offer({ cloudIds: ['scenario'] }))).toEqual(CLOUD)
  })

  // A model uninstalled since the choice was stored, or an account removed: the role keeps
  // working on what is left rather than failing on a preference nothing can honour.
  it('falls back when the choice can no longer be honoured', () => {
    const stale: RoleChoices = { [ASSISTANT_ROLE]: { kind: 'local', modelId: 'gone' } }

    expect(providerFor(ASSISTANT_ROLE, stale, offer({ cloudIds: ['scenario'] }))).toEqual(CLOUD)
    expect(providerFor(ASSISTANT_ROLE, stale, offer())).toBeNull()
  })

  it('keeps the choice of one role out of another', () => {
    const chosen: RoleChoices = { [ASSISTANT_ROLE]: CLOUD }

    expect(providerFor(DICTATION_ROLE, chosen, offer({ localModelIds: ['parakeet'] }))).toEqual({
      kind: 'local',
      modelId: 'parakeet',
    })
  })

  /**
   * Comparing the choice to the DEFAULT — the first usable model — dropped it in silence the
   * moment a role had two, and the screen then ticked the first while the second was stored.
   */
  it('honours a chosen model that is not the one the role would take on its own', () => {
    const second: RoleChoices = { [ASSISTANT_ROLE]: { kind: 'local', modelId: 'mistral' } }

    expect(
      providerFor(ASSISTANT_ROLE, second, offer({ localModelIds: ['llama', 'mistral'] })),
    ).toEqual({ kind: 'local', modelId: 'mistral' })
  })
})
