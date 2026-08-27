import { action, type ActionField, type AssistantAction } from './assistantAction'

/**
 * The project folder, as something a program can walk and change.
 *
 * Paths are relative to the project root with `/` between segments on every platform — the same
 * spelling `FolderEntry` uses, so a listing's `path` is what every other action here takes.
 * `project.open` and `project.create` are the exception and take an absolute one: there is no
 * project yet to be relative to.
 *
 * The native pickers stay where they are. `project.new` and `project.open` as COMMANDS raise a
 * system dialog nobody outside the machine can fill, so a client that called them would hang the
 * studio on a modal — these take the path instead.
 */
const PATHS: ActionField = {
  key: 'paths',
  kind: 'text',
  labelKey: 'assistant.fields.filePaths',
  required: true,
  repeated: true,
}

/**
 * Optional so that the project ROOT can be named at all: it is spelled `''` (`FOLDER_ROOT`), and
 * a required text may not be blank — see `fits`. Absent therefore means the root, exactly as
 * `files.list` already reads it.
 */
const FOLDER: ActionField = {
  key: 'folder',
  kind: 'text',
  labelKey: 'assistant.fields.folderPath',
  required: false,
}

export const FILE_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'project.open',
    titleKey: 'assistant.actions.projectOpen.title',
    descriptionKey: 'assistant.actions.projectOpen.description',
    commitment: 'studio',
    reach: 'mcp',
    fields: [
      { key: 'path', kind: 'text', labelKey: 'assistant.fields.folderPath', required: true },
    ],
  }),
  action({
    /**
     * No field: there is one open project, and naming it would let a caller close a project that
     * is not in front of anyone.
     */
    name: 'project.close',
    titleKey: 'assistant.actions.projectClose.title',
    descriptionKey: 'assistant.actions.projectClose.description',
    commitment: 'studio',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'project.create',
    titleKey: 'assistant.actions.projectCreate.title',
    descriptionKey: 'assistant.actions.projectCreate.description',
    commitment: 'studio',
    reach: 'mcp',
    fields: [
      { key: 'path', kind: 'text', labelKey: 'assistant.fields.folderPath', required: true },
    ],
  }),
  action({
    /**
     * `both`, alone in this family: "open the green sailboat" is what a person SAYS, and a small
     * model shown only the short share could not answer it. `document.open` stayed `mcp` because
     * it needs a listing first; this one needs a name and a search.
     */
    name: 'file.open',
    titleKey: 'assistant.actions.fileOpen.title',
    descriptionKey: 'assistant.actions.fileOpen.description',
    commitment: 'none',
    reach: 'both',
    fields: [{ key: 'path', kind: 'text', labelKey: 'assistant.fields.filePath', required: true }],
  }),
  action({
    name: 'files.list',
    titleKey: 'assistant.actions.filesList.title',
    descriptionKey: 'assistant.actions.filesList.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'folder', kind: 'text', labelKey: 'assistant.fields.folderPath', required: false },
      { key: 'hidden', kind: 'boolean', labelKey: 'assistant.fields.hidden', required: false },
    ],
  }),
  action({
    name: 'files.search',
    titleKey: 'assistant.actions.filesSearch.title',
    descriptionKey: 'assistant.actions.filesSearch.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'query', kind: 'text', labelKey: 'assistant.fields.query', required: true },
      { key: 'hidden', kind: 'boolean', labelKey: 'assistant.fields.hidden', required: false },
    ],
  }),
  action({
    name: 'files.move',
    titleKey: 'assistant.actions.filesMove.title',
    descriptionKey: 'assistant.actions.filesMove.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [PATHS, FOLDER],
  }),
  action({
    // Adds rather than destroys, so no question — see the note on `files` in `assistantAction`.
    name: 'files.copy',
    titleKey: 'assistant.actions.filesCopy.title',
    descriptionKey: 'assistant.actions.filesCopy.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [PATHS, FOLDER],
  }),
  action({
    name: 'files.duplicate',
    titleKey: 'assistant.actions.filesDuplicate.title',
    descriptionKey: 'assistant.actions.filesDuplicate.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [PATHS],
  }),
  action({
    name: 'files.trash',
    titleKey: 'assistant.actions.filesTrash.title',
    descriptionKey: 'assistant.actions.filesTrash.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [PATHS],
  }),
  action({
    name: 'file.rename',
    titleKey: 'assistant.actions.fileRename.title',
    descriptionKey: 'assistant.actions.fileRename.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [
      { key: 'path', kind: 'text', labelKey: 'assistant.fields.filePath', required: true },
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: true },
    ],
  }),
  action({
    name: 'file.facts',
    titleKey: 'assistant.actions.fileFacts.title',
    descriptionKey: 'assistant.actions.fileFacts.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [{ key: 'path', kind: 'text', labelKey: 'assistant.fields.filePath', required: true }],
  }),
  action({
    name: 'folder.new',
    titleKey: 'assistant.actions.folderNew.title',
    descriptionKey: 'assistant.actions.folderNew.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      FOLDER,
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: true },
    ],
  }),
  /**
   * The stack the Explorer's ⌘Z drives, which lives in the main process and per project: a batch
   * made in one window is taken back from another, and from here.
   */
  action({
    name: 'files.undo',
    titleKey: 'assistant.actions.filesUndo.title',
    descriptionKey: 'assistant.actions.filesUndo.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'files.redo',
    titleKey: 'assistant.actions.filesRedo.title',
    descriptionKey: 'assistant.actions.filesRedo.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'files.history',
    titleKey: 'assistant.actions.filesHistory.title',
    descriptionKey: 'assistant.actions.filesHistory.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'file.reveal',
    titleKey: 'assistant.actions.fileReveal.title',
    descriptionKey: 'assistant.actions.fileReveal.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [{ key: 'path', kind: 'text', labelKey: 'assistant.fields.filePath', required: true }],
  }),
  action({
    // The absolute path, like the two above it: the shelf renames projects it has not opened.
    name: 'project.rename',
    titleKey: 'assistant.actions.projectRename.title',
    descriptionKey: 'assistant.actions.projectRename.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [
      { key: 'path', kind: 'text', labelKey: 'assistant.fields.folderPath', required: true },
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: true },
    ],
  }),
]
