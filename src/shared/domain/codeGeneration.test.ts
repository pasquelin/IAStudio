import { describe, expect, it } from 'vitest'
import { codeChatPrompt, cloudOfModelId, cloudModelId, unfencedCode } from './codeGeneration'

describe('the model id a cloud code generation names', () => {
  it('reads back the cloud it was composed from', () => {
    expect(cloudOfModelId(cloudModelId('anthropic'))).toBe('anthropic')
  })

  it('answers nothing for a model of this machine, which never reaches a cloud', () => {
    expect(cloudOfModelId('qwen2.5-coder-7b-instruct-q4')).toBeNull()
  })

  /** A stored choice outlives the build that wrote it: an id no registry holds is not a cloud. */
  it('answers nothing for a cloud this build no longer knows', () => {
    expect(cloudOfModelId('cloud:some-cloud-that-went-away')).toBeNull()
  })
})

describe('what a chat is asked for a script', () => {
  it('shows the API a script may reach, and asks for the script alone', () => {
    const { system } = codeChatPrompt({ prompt: 'spin it', source: null, api: 'declare module' })

    expect(system).toContain('declare module')
    expect(system).toContain('SCRIPT ALONE')
  })

  it('sends the words alone when nothing is being reworked', () => {
    expect(codeChatPrompt({ prompt: 'spin it', source: null, api: '' }).user).toBe('spin it')
  })

  it('sends the script in full beside the words when one is being reworked', () => {
    const { user } = codeChatPrompt({
      prompt: 'slow it down',
      source: 'export const x = 1',
      api: '',
    })

    expect(user).toContain('slow it down')
    expect(user).toContain('export const x = 1')
  })
})

/**
 * 🛑 MEASURED, and no gate of the repository sees it: electron-vite finds the last static import
 * by regex and writes its CommonJS shim after it. A briefing line reading as one takes the shim
 * INSIDE the string, `pnpm build` dies on an unterminated literal, and `pnpm validate` stays green.
 */
describe('what the briefing may not look like', () => {
  it('holds no line a bundler would read as a static import', () => {
    const briefing = codeChatPrompt({ prompt: '', source: null, api: '' }).system

    expect(briefing).not.toMatch(/\bimport\b[^\n]*\bfrom\b\s*['"]/)
  })
})

describe('the script a chat answered', () => {
  it('takes off the fence a chat wrapped it in', () => {
    expect(unfencedCode('```ts\nexport const x = 1\n```')).toBe('export const x = 1')
  })

  it('takes off a fence that names no language', () => {
    expect(unfencedCode('```\nexport const x = 1\n```')).toBe('export const x = 1')
  })

  it('leaves a script that came back bare alone', () => {
    expect(unfencedCode('  export const x = 1  ')).toBe('export const x = 1')
  })

  /** 🛑 A closing fence followed by a sentence: the whole document opened on ``` and never compiled. */
  it('takes off a fence a chat added a word after', () => {
    expect(unfencedCode('```ts\nexport const x = 1\n```\nLet me know if you want more.')).toBe(
      'export const x = 1',
    )
  })

  /** 🛑 A script whose own text holds three backticks must not come back cut in half. */
  it('leaves a script holding backticks of its own whole', () => {
    const script = 'const help = `\n```\n`'

    expect(unfencedCode(script)).toBe(script)
  })
})
