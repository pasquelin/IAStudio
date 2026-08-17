import { action, type AssistantAction } from './assistantAction'

/**
 * What the studio is, and which document is in front.
 *
 * The family that had to come first: `command.run` refuses anything whose surface is not
 * active, and before these there was no way to ask which one WAS. A client that cannot read
 * state does not drive the studio, it guesses at it — and a guess that reaches
 * `generator.submit` spends.
 *
 * All of them `mcp`: the assistant lives in the window and can see the answer already.
 */
export const STATE_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'studio.state',
    titleKey: 'assistant.actions.studioState.title',
    descriptionKey: 'assistant.actions.studioState.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'documents.list',
    titleKey: 'assistant.actions.documentsList.title',
    descriptionKey: 'assistant.actions.documentsList.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'document.open',
    titleKey: 'assistant.actions.documentOpen.title',
    descriptionKey: 'assistant.actions.documentOpen.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [{ key: 'path', kind: 'text', labelKey: 'assistant.fields.filePath', required: true }],
  }),
  action({
    name: 'document.activate',
    titleKey: 'assistant.actions.documentActivate.title',
    descriptionKey: 'assistant.actions.documentActivate.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'documentId', kind: 'text', labelKey: 'assistant.fields.documentId', required: true },
    ],
  }),
  action({
    /**
     * `none`, and that is not an oversight: `closeDocument` raises its OWN question about unsaved
     * work, and it is the one that knows whether there is any. A `files` level here asked twice
     * for one gesture, and the first question could not say what was at stake.
     */
    name: 'document.close',
    titleKey: 'assistant.actions.documentClose.title',
    descriptionKey: 'assistant.actions.documentClose.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'documentId', kind: 'text', labelKey: 'assistant.fields.documentId', required: true },
    ],
  }),
  action({
    name: 'document.rename',
    titleKey: 'assistant.actions.documentRename.title',
    descriptionKey: 'assistant.actions.documentRename.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [
      { key: 'documentId', kind: 'text', labelKey: 'assistant.fields.documentId', required: true },
      { key: 'title', kind: 'text', labelKey: 'assistant.fields.title', required: true },
    ],
  }),
  action({
    name: 'activity.recent',
    titleKey: 'assistant.actions.activityRecent.title',
    descriptionKey: 'assistant.actions.activityRecent.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'limit',
        kind: 'integer',
        labelKey: 'assistant.fields.limit',
        required: false,
        min: 1,
        max: 200,
      },
    ],
  }),
]
