import { action, type AssistantAction } from './assistantAction'
import { COMPONENT_TYPES } from './componentRegistry'

/**
 * What an object DOES while the game runs, driven from outside the window.
 *
 * Its own family and its own file from the first action, rather than three more entries in the
 * scene's 41,9 Ko: the game families are what would turn that file into the one nobody opens.
 *
 * The `type` field offers the registry's own list, so a component added to the registry is
 * offered to a model here without a line being written.
 *
 * `reach: 'mcp'` for all three, and it is measured rather than timid: the briefing the window's
 * own assistant reads is already at its width, and three more entries push it past — the same
 * wall `context.*` met. The inspector is how the window does this.
 */
export const GAME_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'component.attach',
    titleKey: 'assistant.actions.componentAttach.title',
    descriptionKey: 'assistant.actions.componentAttach.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'nodeId', kind: 'text', labelKey: 'assistant.fields.nodeId', required: true },
      {
        key: 'type',
        kind: 'choice',
        labelKey: 'assistant.fields.componentType',
        required: true,
        options: COMPONENT_TYPES,
      },
    ],
  }),
  action({
    name: 'component.detach',
    titleKey: 'assistant.actions.componentDetach.title',
    descriptionKey: 'assistant.actions.componentDetach.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'nodeId', kind: 'text', labelKey: 'assistant.fields.nodeId', required: true },
      {
        key: 'type',
        kind: 'choice',
        labelKey: 'assistant.fields.componentType',
        required: true,
        options: COMPONENT_TYPES,
      },
    ],
  }),
  action({
    /**
     * One field at a time, and the value travels as TEXT: a component's fields differ by type, so
     * a schema naming them all would describe none of them — and a `raw` parameter is one no
     * client can build from. The handler converts it by the kind the DESCRIPTOR declares.
     */
    name: 'component.set',
    titleKey: 'assistant.actions.componentSet.title',
    descriptionKey: 'assistant.actions.componentSet.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'nodeId', kind: 'text', labelKey: 'assistant.fields.nodeId', required: true },
      {
        key: 'type',
        kind: 'choice',
        labelKey: 'assistant.fields.componentType',
        required: true,
        options: COMPONENT_TYPES,
      },
      { key: 'field', kind: 'text', labelKey: 'assistant.fields.componentField', required: true },
      { key: 'value', kind: 'text', labelKey: 'assistant.fields.componentValue', required: true },
    ],
  }),
]
