import { describe, expect, it } from 'vitest'
import {
  chatModelOf,
  CLOUD_IDS,
  CLOUD_PROVIDERS,
  cloudsServing,
  defaultChatModel,
  isCloudProviderId,
} from './aiCloud'
import { aiRoleId, ASSISTANT_ROLE, DICTATION_ROLE } from './aiRole'

describe('the cloud registry', () => {
  /**
   * What a cloud serves is DATA it declares, so a role nothing lists is offered none without a
   * single condition being written about it. Dictation is that role: nothing here turns speech
   * into text off this machine.
   */
  it('offers a cloud only where one declares serving the role', () => {
    expect(cloudsServing(aiRoleId('image', 'inpaint'))).toEqual(['scenario'])
    expect(cloudsServing(ASSISTANT_ROLE)).toEqual(CLOUD_IDS)
    expect(cloudsServing(DICTATION_ROLE)).toEqual([])
  })

  // The registry decides, never a string that arrived from a stored file or an IPC payload.
  it('answers for the ids it holds, and for no other', () => {
    expect(isCloudProviderId('scenario')).toBe(true)
    expect(isCloudProviderId('openai')).toBe(true)
    expect(isCloudProviderId('nowhere')).toBe(false)
    expect(isCloudProviderId(null)).toBe(false)
  })

  /**
   * The whole point of the list: a second cloud is an ENTRY, and everything that reads the
   * registry follows it — no branch anywhere learns its name.
   */
  it('would serve a role from an entry nobody had to teach the code about', () => {
    expect(CLOUD_IDS).toEqual(CLOUD_PROVIDERS.map(one => one.id))
    expect(CLOUD_PROVIDERS.every(one => one.id.length > 0)).toBe(true)
  })

  /**
   * Scenario answers `null`, which is the reading « this one is not talked to over HTTP »: its
   * thinking goes through the catalogue, on one of a fixed four that are priced and enumerated.
   */
  it('declares the model each cloud is talked to with', () => {
    expect(defaultChatModel('deepseek')).toBe('deepseek-chat')
    expect(defaultChatModel('scenario')).toBeNull()
    expect(defaultChatModel('nowhere')).toBeNull()
  })

  it('takes a name typed for a cloud, and reads one emptied as none', () => {
    expect(chatModelOf('deepseek-reasoner', 'deepseek-chat')).toBe('deepseek-reasoner')
    expect(chatModelOf(undefined, 'deepseek-chat')).toBe('deepseek-chat')
    expect(chatModelOf('  ', 'deepseek-chat')).toBe('deepseek-chat')
  })
})
