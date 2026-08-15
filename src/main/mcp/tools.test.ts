import { describe, expect, it } from 'vitest'
import { ACTION_REGISTRY } from '@shared/domain/assistant'
import { actionOfTool, mcpTools, schemaOfFields, toolName } from './tools'

describe('the registry, published as tools', () => {
  it('offers every action, and nothing else', () => {
    expect(
      mcpTools()
        .map(tool => tool.name)
        .sort(),
    ).toEqual(ACTION_REGISTRY.map(action => toolName(action.name)).sort())
  })

  /**
   * The dot has to go: an action is `command.run`, and the tool-name grammar clients hold us to
   * takes letters, digits, underscore and dash. A name that fails it is refused by the client
   * rather than by us, which is the hardest kind of failure to place.
   */
  it('names each tool in the grammar a client accepts, and finds the action back', () => {
    for (const tool of mcpTools()) {
      expect(tool.name, tool.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/)
      expect(actionOfTool(tool.name)).not.toBeNull()
    }
  })

  it('answers nothing for a name the registry does not declare', () => {
    expect(actionOfTool('command_fly')).toBeNull()
  })

  // So a client can say "this will ask you first" before it makes the call, rather than appear
  // to hang for the two minutes a question is allowed to stand.
  it('says on the tool itself what running it engages', () => {
    const submit = mcpTools().find(tool => tool.name === 'generator_submit')

    expect(submit?.description).toContain('spends creative units')
  })
})

describe('an action’s inputs, as JSON Schema', () => {
  it('carries the closed set of a choice, and marks what is required', () => {
    const schema = schemaOfFields([
      { key: 'family', kind: 'choice', labelKey: 'x', required: true, options: ['image', '3d'] },
      { key: 'note', kind: 'text', labelKey: 'x', required: false },
    ])

    expect(schema.properties['family']).toMatchObject({ type: 'string', enum: ['image', '3d'] })
    expect(schema.required).toEqual(['family'])
    // A key nobody declared would be refused against the registry anyway; saying so in the
    // schema saves the round trip.
    expect(schema.additionalProperties).toBe(false)
  })

  /**
   * `raw` carries a generation model's own parameters, whose shape is only known once
   * `GET /models/{id}` has answered — announcing it as an object would be a promise the
   * registry cannot keep.
   */
  it('leaves a raw field untyped rather than guessing at it', () => {
    const schema = schemaOfFields([
      { key: 'parameters', kind: 'raw', labelKey: 'assistant.fields.parameters', required: true },
    ])

    expect(schema.properties['parameters']).not.toHaveProperty('type')
    expect(schema.properties['parameters']?.description).not.toBe('')
  })
})
