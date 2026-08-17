import { action, type ActionField, type AssistantAction } from './assistantAction'

/**
 * The project's repository, as far as this machine.
 *
 * The panel's own channels, published: every one answers with the state it LEFT, so a client
 * never has to read the status back after acting.
 *
 * `fetch`, `pull` and `push` are deliberately NOT here, and neither are the credential
 * channels. Everything below stays on the disk this studio is running on; publishing to a
 * server is the one git gesture nothing local can undo, and the credentials are a secret the
 * renderer is not allowed to read back — see invariant 1.
 */

const PATHS: ActionField = {
  key: 'paths',
  kind: 'text',
  labelKey: 'assistant.fields.gitPaths',
  required: true,
  repeated: true,
}

export const GIT_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'git.status',
    titleKey: 'assistant.actions.gitStatus.title',
    descriptionKey: 'assistant.actions.gitStatus.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'git.log',
    titleKey: 'assistant.actions.gitLog.title',
    descriptionKey: 'assistant.actions.gitLog.description',
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
      { key: 'skip', kind: 'integer', labelKey: 'assistant.fields.skip', required: false, min: 0 },
    ],
  }),
  action({
    name: 'git.commitFiles',
    titleKey: 'assistant.actions.gitCommitFiles.title',
    descriptionKey: 'assistant.actions.gitCommitFiles.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'hash', kind: 'text', labelKey: 'assistant.fields.commitHash', required: true },
    ],
  }),
  action({
    name: 'git.diff',
    titleKey: 'assistant.actions.gitDiff.title',
    descriptionKey: 'assistant.actions.gitDiff.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'path', kind: 'text', labelKey: 'assistant.fields.gitPath', required: true },
      { key: 'commit', kind: 'text', labelKey: 'assistant.fields.commitHash', required: false },
    ],
  }),
  action({
    name: 'git.branches',
    titleKey: 'assistant.actions.gitBranches.title',
    descriptionKey: 'assistant.actions.gitBranches.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'git.stashes',
    titleKey: 'assistant.actions.gitStashes.title',
    descriptionKey: 'assistant.actions.gitStashes.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'git.init',
    titleKey: 'assistant.actions.gitInit.title',
    descriptionKey: 'assistant.actions.gitInit.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'git.stage',
    titleKey: 'assistant.actions.gitStage.title',
    descriptionKey: 'assistant.actions.gitStage.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [PATHS],
  }),
  action({
    name: 'git.unstage',
    titleKey: 'assistant.actions.gitUnstage.title',
    descriptionKey: 'assistant.actions.gitUnstage.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [PATHS],
  }),
  action({
    // The one git gesture that destroys work outright: what was not recorded is gone, and no
    // Explorer undo reaches it.
    name: 'git.restore',
    titleKey: 'assistant.actions.gitRestore.title',
    descriptionKey: 'assistant.actions.gitRestore.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [PATHS],
  }),
  action({
    name: 'git.commit',
    titleKey: 'assistant.actions.gitCommit.title',
    descriptionKey: 'assistant.actions.gitCommit.description',
    commitment: 'none',
    // Recording a version adds one; amending REPLACES the one already recorded, and its message
    // and its parent are gone with it. That is the same loss `git.restore` is asked about.
    raises: input => (input.amend === true ? 'files' : 'none'),
    reach: 'mcp',
    fields: [
      { key: 'message', kind: 'longText', labelKey: 'assistant.fields.message', required: true },
      { key: 'amend', kind: 'boolean', labelKey: 'assistant.fields.amend', required: false },
    ],
  }),
  action({
    name: 'git.createBranch',
    titleKey: 'assistant.actions.gitCreateBranch.title',
    descriptionKey: 'assistant.actions.gitCreateBranch.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.branchName', required: true },
    ],
  }),
  action({
    // Rewrites the working tree, and a document open in a tab is then a document whose file has
    // changed under it.
    name: 'git.checkout',
    titleKey: 'assistant.actions.gitCheckout.title',
    descriptionKey: 'assistant.actions.gitCheckout.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.branchName', required: true },
    ],
  }),
  action({
    name: 'git.stash',
    titleKey: 'assistant.actions.gitStash.title',
    descriptionKey: 'assistant.actions.gitStash.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [
      { key: 'message', kind: 'text', labelKey: 'assistant.fields.message', required: false },
    ],
  }),
  action({
    name: 'git.stashPop',
    titleKey: 'assistant.actions.gitStashPop.title',
    descriptionKey: 'assistant.actions.gitStashPop.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [
      {
        key: 'index',
        kind: 'integer',
        labelKey: 'assistant.fields.stashIndex',
        required: true,
        min: 0,
      },
    ],
  }),
  action({
    name: 'git.tag',
    titleKey: 'assistant.actions.gitTag.title',
    descriptionKey: 'assistant.actions.gitTag.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.tagName', required: true },
      { key: 'commit', kind: 'text', labelKey: 'assistant.fields.commitHash', required: true },
    ],
  }),
]
