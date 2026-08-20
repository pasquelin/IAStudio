import { action, type ActionField, type AssistantAction } from './assistantAction'
import { HUMANOID_ROLES } from './humanoid'

/**
 * Making a character move — its skeleton, the handles a joint reaches for, and the blocks laid
 * on its band.
 *
 * One family rather than two: the inspector and the band are two panels of the same job, and a
 * client that can weigh a mesh but not lay a clip on it has been handed half a workflow. Every
 * one of these runs the very command the panel runs, so a batch lands in the scene's own history
 * and ⌘Z takes it back.
 *
 * They act on a model node of the 3D tab in front — `scene.state` says which nodes those are.
 */
const NODE: ActionField = {
  key: 'nodeId',
  kind: 'text',
  labelKey: 'assistant.fields.nodeId',
  required: true,
}

const BONE: ActionField = {
  key: 'bone',
  kind: 'text',
  labelKey: 'assistant.fields.boneName',
  required: true,
}

export const RIG_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'rig.state',
    titleKey: 'assistant.actions.rigState.title',
    descriptionKey: 'assistant.actions.rigState.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE],
  }),
  action({
    /**
     * The skeleton the studio fits to the mesh it has measured — what « make animatable » does.
     * Refused while the engine has not read the model, which is a wait rather than a fault.
     */
    name: 'rig.fit',
    titleKey: 'assistant.actions.rigFit.title',
    descriptionKey: 'assistant.actions.rigFit.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE],
  }),
  action({
    name: 'rig.clear',
    titleKey: 'assistant.actions.rigClear.title',
    descriptionKey: 'assistant.actions.rigClear.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE],
  }),
  action({
    name: 'rig.hands',
    titleKey: 'assistant.actions.rigHands.title',
    descriptionKey: 'assistant.actions.rigHands.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE],
  }),
  action({
    // The name is composed from the parent's, as the panel's own button does — a bone named from
    // a word would read differently in a document opened in another language.
    name: 'bone.add',
    titleKey: 'assistant.actions.boneAdd.title',
    descriptionKey: 'assistant.actions.boneAdd.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE, { ...BONE, key: 'parent', labelKey: 'assistant.fields.parentBone' }],
  }),
  action({
    name: 'bone.remove',
    titleKey: 'assistant.actions.boneRemove.title',
    descriptionKey: 'assistant.actions.boneRemove.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE, BONE],
  }),
  action({
    name: 'bone.rename',
    titleKey: 'assistant.actions.boneRename.title',
    descriptionKey: 'assistant.actions.boneRename.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      BONE,
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: true },
    ],
  }),
  action({
    // The roles keep the standard's own spelling, untranslated: they are the identifiers of the
    // Mixamo set. An absent role says the bone fills none.
    name: 'bone.role',
    titleKey: 'assistant.actions.boneRole.title',
    descriptionKey: 'assistant.actions.boneRole.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      BONE,
      {
        key: 'role',
        kind: 'choice',
        labelKey: 'assistant.fields.boneRole',
        required: false,
        options: HUMANOID_ROLES,
      },
    ],
  }),
  action({
    name: 'ik.add',
    titleKey: 'assistant.actions.ikAdd.title',
    descriptionKey: 'assistant.actions.ikAdd.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE, BONE],
  }),
  action({
    name: 'ik.remove',
    titleKey: 'assistant.actions.ikRemove.title',
    descriptionKey: 'assistant.actions.ikRemove.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'chainId', kind: 'text', labelKey: 'assistant.fields.chainId', required: true },
    ],
  }),
  action({
    name: 'animation.add',
    titleKey: 'assistant.actions.animationAdd.title',
    descriptionKey: 'assistant.actions.animationAdd.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'assetId', kind: 'text', labelKey: 'assistant.fields.assetId', required: true },
    ],
  }),
  action({
    name: 'animation.remove',
    titleKey: 'assistant.actions.animationRemove.title',
    descriptionKey: 'assistant.actions.animationRemove.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'clipId', kind: 'text', labelKey: 'assistant.fields.clipId', required: true },
    ],
  }),
  action({
    name: 'animation.settings',
    titleKey: 'assistant.actions.animationSettings.title',
    descriptionKey: 'assistant.actions.animationSettings.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'durationSeconds',
        kind: 'number',
        labelKey: 'assistant.fields.durationSeconds',
        required: false,
        min: 0,
      },
      { key: 'fps', kind: 'integer', labelKey: 'assistant.fields.fps', required: false, min: 1 },
    ],
  }),
  action({
    // Session state, like every other way of looking at a scene: it decides whether moving a bone
    // writes a key, and nothing of it is saved with the document.
    name: 'animation.autoKey',
    titleKey: 'assistant.actions.animationAutoKey.title',
    descriptionKey: 'assistant.actions.animationAutoKey.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [{ key: 'on', kind: 'boolean', labelKey: 'assistant.fields.autoKey', required: true }],
  }),
]
