import { TIMELINE_TEMPLATES } from './animation'
import { TEMPLATES_BY_GROUP } from './sceneTemplate'
import { action, type ActionField, type AssistantAction } from './assistantAction'
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

/**
 * A game being PLAYED, driven from outside the window.
 *
 * 🛑 What closes the loop of the plan's § 16.4 — `play.start` → `runtime.errors` → `script.write`
 * → `play.stop` → `play.start`. Four things make it close, and each is a decision:
 * `play.start` answers at once rather than waiting for a frame; `runtime.errors` answers
 * ADDRESSABLE faults, script and line; a script that throws is disarmed rather than stopping the
 * game; and `play.step` runs ONE fixed step, so a reading is taken without racing the clock.
 */
export const PLAY_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'play.start',
    titleKey: 'assistant.actions.playStart.title',
    descriptionKey: 'assistant.actions.playStart.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'play.stop',
    titleKey: 'assistant.actions.playStop.title',
    descriptionKey: 'assistant.actions.playStop.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'play.pause',
    titleKey: 'assistant.actions.playPause.title',
    descriptionKey: 'assistant.actions.playPause.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'play.resume',
    titleKey: 'assistant.actions.playResume.title',
    descriptionKey: 'assistant.actions.playResume.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    /** One fixed step, so a reading is taken without racing sixty frames a second. */
    name: 'play.step',
    titleKey: 'assistant.actions.playStep.title',
    descriptionKey: 'assistant.actions.playStep.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'steps', kind: 'integer', labelKey: 'assistant.fields.fixedSteps', required: false },
    ],
  }),
  action({
    /** What a running game GOES TO. Refused when nothing is playing — there is no game to move. */
    name: 'play.loadScene',
    titleKey: 'assistant.actions.playLoadScene.title',
    descriptionKey: 'assistant.actions.playLoadScene.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'scene', kind: 'text', labelKey: 'assistant.fields.sceneToLoad', required: true },
      { key: 'fade', kind: 'number', labelKey: 'assistant.fields.fadeSeconds', required: false },
    ],
  }),
  action({
    name: 'runtime.report',
    titleKey: 'assistant.actions.runtimeReport.title',
    descriptionKey: 'assistant.actions.runtimeReport.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    /** 🛑 ADDRESSABLE: the script's reference and the line, which is what a repair needs. */
    name: 'runtime.errors',
    titleKey: 'assistant.actions.runtimeErrors.title',
    descriptionKey: 'assistant.actions.runtimeErrors.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
]

/** The `.ts` files a game runs, read and written from outside the window. */
export const SCRIPT_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'script.list',
    titleKey: 'assistant.actions.scriptList.title',
    descriptionKey: 'assistant.actions.scriptList.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'script.read',
    titleKey: 'assistant.actions.scriptRead.title',
    descriptionKey: 'assistant.actions.scriptRead.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'path', kind: 'text', labelKey: 'assistant.fields.scriptPath', required: true },
    ],
  }),
  action({
    /**
     * Writes a file of the project, which `commitment: 'file'` is what says: it lands on disk and
     * no undo of the studio takes it back — git does.
     */
    name: 'script.write',
    titleKey: 'assistant.actions.scriptWrite.title',
    descriptionKey: 'assistant.actions.scriptWrite.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [
      { key: 'path', kind: 'text', labelKey: 'assistant.fields.scriptPath', required: true },
      {
        key: 'source',
        kind: 'longText',
        labelKey: 'assistant.fields.scriptSource',
        required: true,
      },
    ],
  }),
]

/**
 * The three that keep a model from having to GUESS — the plan's § 16.3.
 *
 * 🛑 They are the answer to the tool count, not a convenience: describing what is in front of a
 * model, serving the slice of documentation that answers ONE question, and running a lot of
 * primitives as a single undo entry are what a hundred narrow actions would otherwise be.
 */
export const STUDIO_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'studio.describe',
    titleKey: 'assistant.actions.studioDescribe.title',
    descriptionKey: 'assistant.actions.studioDescribe.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'ref', kind: 'text', labelKey: 'assistant.fields.describeRef', required: false },
    ],
  }),
  action({
    /** The same source the editor types against — `studio.d.ts`, sliced by topic. */
    name: 'studio.docs',
    titleKey: 'assistant.actions.studioDocs.title',
    descriptionKey: 'assistant.actions.studioDocs.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'topic', kind: 'text', labelKey: 'assistant.fields.docsTopic', required: false },
    ],
  }),
  action({
    /**
     * 🛑 ONE undo entry and ONE confirmation for a lot of calls — `composed()` of `history.ts`.
     * The commitment of the lot is the MAXIMUM of the calls', so a batch never engages less than
     * what it holds.
     */
    name: 'studio.batch',
    titleKey: 'assistant.actions.studioBatch.title',
    descriptionKey: 'assistant.actions.studioBatch.description',
    // 🛑 `none` for the LOT, and every call inside asked about on its own terms. Weighing the lot
    // at the worst of what it holds, then asking once, collapsed five independent delegation
    // switches into one — see `runBatch`, which carries the whole reasoning.
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'calls', kind: 'longText', labelKey: 'assistant.fields.batchCalls', required: true },
    ],
  }),
]

/** One call of a batch: the action to run and what to run it with. */
export type BatchCall = { action: string; input: Record<string, unknown> }

/** The four lists a game writes into, offered as a closed set rather than typed by hand. */
export const TIMELINE_LISTS: readonly string[] = ['events', 'audio', 'video', 'transitions']

/**
 * What a timeline CUES, put there from outside the window.
 *
 * 🛑 ONE action for the four lists rather than four: what changes between them is the shape of
 * the row, and `component.set` already settled that question here — the value travels as TEXT
 * and the handler reads it by what the list declares. Four narrow actions would be four schemas
 * a model has to tell apart before it can ask for anything.
 */
export const TIMELINE_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'timeline.cue',
    titleKey: 'assistant.actions.timelineCue.title',
    descriptionKey: 'assistant.actions.timelineCue.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'list',
        kind: 'choice',
        labelKey: 'assistant.fields.timelineList',
        required: true,
        options: TIMELINE_LISTS,
      },
      { key: 'at', kind: 'number', labelKey: 'assistant.fields.timelineAt', required: true },
      /** What the row IS: an event's name, an asset's id, a transition's kind. */
      { key: 'what', kind: 'text', labelKey: 'assistant.fields.timelineWhat', required: true },
      {
        key: 'duration',
        kind: 'number',
        labelKey: 'assistant.fields.timelineDuration',
        required: false,
      },
      { key: 'entity', kind: 'text', labelKey: 'assistant.fields.nodeId', required: false },
      /** Where a TRANSITION goes. Read by nothing on the other lists — a sound goes nowhere. */
      { key: 'scene', kind: 'text', labelKey: 'assistant.fields.sceneToLoad', required: false },
    ],
  }),
  action({
    name: 'timeline.remove',
    titleKey: 'assistant.actions.timelineRemove.title',
    descriptionKey: 'assistant.actions.timelineRemove.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'list',
        kind: 'choice',
        labelKey: 'assistant.fields.timelineList',
        required: true,
        options: TIMELINE_LISTS,
      },
      { key: 'id', kind: 'text', labelKey: 'assistant.fields.timelineRowId', required: true },
    ],
  }),
  action({
    /** 🛑 A filter of VIEW: it decides what the panel offers, never what the engine can do. */
    name: 'timeline.template',
    titleKey: 'assistant.actions.timelineTemplate.title',
    descriptionKey: 'assistant.actions.timelineTemplate.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'template',
        kind: 'choice',
        labelKey: 'assistant.fields.timelineTemplate',
        required: true,
        options: TIMELINE_TEMPLATES,
      },
    ],
  }),
]

/**
 * One axis of a position, spelled `positionX` as the rest of the registry spells it: a model
 * that learned the name on another tool would otherwise place every prefab at the origin.
 */
const axisField = (axis: 'X' | 'Y' | 'Z'): ActionField => ({
  key: `position${axis}`,
  kind: 'number',
  labelKey: `assistant.fields.position${axis}`,
  required: false,
})

/**
 * What puts a whole game together in one gesture.
 *
 * 🛑 An ASSEMBLY, never an engine: a template lays down nodes carrying components the runtime
 * already has systems for, and a prefab is a document of the project instanced into the scene.
 * Neither adds a way of playing — that is what keeps them from becoming a second runtime.
 */
export const ASSEMBLY_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'game.template',
    titleKey: 'assistant.actions.gameTemplate.title',
    descriptionKey: 'assistant.actions.gameTemplate.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'template',
        kind: 'choice',
        labelKey: 'assistant.fields.gameTemplate',
        required: true,
        options: TEMPLATES_BY_GROUP.character,
      },
    ],
  }),
  action({
    /** A document of the project, instanced where it is asked for — its nodes, its components. */
    name: 'prefab.instantiate',
    titleKey: 'assistant.actions.prefabInstantiate.title',
    descriptionKey: 'assistant.actions.prefabInstantiate.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'prefab', kind: 'text', labelKey: 'assistant.fields.prefabRef', required: true },
      axisField('X'),
      axisField('Y'),
      axisField('Z'),
    ],
  }),
]

/** Writing a game that runs with no studio — the plan's § 19. */
export const EXPORT_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'game.export',
    titleKey: 'assistant.actions.gameExport.title',
    descriptionKey: 'assistant.actions.gameExport.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'entryScene', kind: 'text', labelKey: 'assistant.fields.entryScene', required: false },
      { key: 'title', kind: 'text', labelKey: 'assistant.fields.gameTitle', required: false },
    ],
  }),
]
