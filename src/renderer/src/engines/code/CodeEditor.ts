import type * as Monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import STUDIO_TYPES from '@game/api/studio.d.ts?raw'

/** One thing wrong with a script, where an editor opens it. The shape a problems list reads. */
export type CodeProblem = {
  script: string
  message: string
  line: number
  column: number
  severity: 'error' | 'warning'
}

export type CodeEditorDeps = {
  host: HTMLElement
  /** Told on every keystroke, debounced by the caller if it writes to disk. */
  onChanged: (script: string, source: string) => void
  /** Told whenever the type worker has finished: the whole list, never a delta. */
  onProblems: (problems: readonly CodeProblem[]) => void
}

/**
 * Monaco, behind a façade with no React in it — CLAUDE.md invariant 4.
 *
 * 🛑 The worker does the typing, and it is the whole point: what makes a wrong asset name RED
 * before a Play is the same TypeScript that compiles it, reading `studio.d.ts` and the project's
 * own declaration. Nothing here re-implements a diagnostic.
 */
export class CodeEditor {
  private readonly editor: Monaco.editor.IStandaloneCodeEditor
  private readonly models = new Map<string, Monaco.editor.ITextModel>()
  private readonly watching: Monaco.IDisposable[] = []
  private project: Monaco.IDisposable | null = null
  private open: string | null = null

  constructor(
    private readonly monaco: typeof Monaco,
    deps: CodeEditorDeps,
  ) {
    this.editor = monaco.editor.create(deps.host, {
      // Read off the studio's own theme rather than Monaco's: `paintTheme` follows the setting.
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontLigatures: true,
      tabSize: 2,
      renderWhitespace: 'selection',
    })

    this.watching.push(
      monaco.editor.onDidChangeMarkers(() => deps.onProblems(this.problems())),
      this.editor.onDidChangeModelContent(() => {
        const script = this.open
        const model = this.editor.getModel()
        if (script && model) deps.onChanged(script, model.getValue())
      }),
    )
  }

  /** Shows that script, making its model the first time it is asked for. */
  show(script: string, source: string): void {
    let model = this.models.get(script)
    if (!model) {
      model = this.monaco.editor.createModel(source, 'typescript', uriOf(this.monaco, script))
      this.models.set(script, model)
    } else if (model.getValue() !== source) {
      // Set rather than replaced: `setValue` drops undo, and a file re-read on every Play would
      // otherwise cost an author their history.
      model.setValue(source)
    }
    this.open = script
    this.editor.setModel(model)
  }

  /** Puts the cursor on that line and scrolls to it — what a console error opens. */
  reveal(line: number, column: number): void {
    this.editor.revealPositionInCenter({ lineNumber: line, column })
    this.editor.setPosition({ lineNumber: line, column })
    this.editor.focus()
  }

  forget(script: string): void {
    this.models.get(script)?.dispose()
    this.models.delete(script)
    if (this.open === script) this.open = null
  }

  sourceOf(script: string): string | null {
    return this.models.get(script)?.getValue() ?? null
  }

  /**
   * What the project itself declares — the names of its assets, its scenes, its prefabs.
   *
   * Replaced whole rather than added to: a second `addExtraLib` under the same path is what makes
   * a deleted asset keep completing for the rest of the session.
   */
  declareProject(types: string): void {
    this.project?.dispose()
    this.project = this.monaco.languages.typescript.typescriptDefaults.addExtraLib(
      types,
      PROJECT_TYPES,
    )
  }

  /** Everything the type worker has to say, over every open script. */
  problems(): readonly CodeProblem[] {
    return this.monaco.editor
      .getModelMarkers({})
      .filter(marker => marker.severity >= this.monaco.MarkerSeverity.Warning)
      .map(marker => ({
        script: scriptOf(marker.resource.path),
        message: marker.message,
        line: marker.startLineNumber,
        column: marker.startColumn,
        severity: severityOf(marker.severity === this.monaco.MarkerSeverity.Error),
      }))
  }

  dispose(): void {
    for (const held of this.watching) held.dispose()
    for (const model of this.models.values()) model.dispose()
    this.models.clear()
    this.project?.dispose()
    this.editor.dispose()
  }
}

const STUDIO_TYPES_PATH = 'file:///node_modules/@studio/index.d.ts'
const PROJECT_TYPES = 'file:///node_modules/@studio/project.d.ts'

const uriOf = (monaco: typeof Monaco, script: string): Monaco.Uri =>
  monaco.Uri.parse(`file:///${script.replace(/^script:/, '')}`)

const scriptOf = (path: string): string => `script:${path.replace(/^\//, '')}`

const severityOf = (worst: boolean): CodeProblem['severity'] => (worst ? 'error' : 'warning')

/**
 * 🛑 Loaded on FIRST OPEN, never at startup. Measured out of `pnpm build` on 2026-08-27:
 * `editor.main` 6,1 Mo, `ts.worker` 11,5 Mo, `editor.worker` 492 Ko and 186 Ko of CSS — some
 * eighteen megabytes, more than twice what the spike suggested. The entry chunk is unchanged at
 * 1,78 Mo, which is the whole point of asking for it here.
 */
let loading: Promise<typeof Monaco> | null = null

export async function loadCodeEditor(deps: CodeEditorDeps): Promise<CodeEditor> {
  loading ??= start()
  let monaco: typeof Monaco
  try {
    monaco = await loading
  } catch (trouble) {
    loading = null
    throw trouble
  }
  return new CodeEditor(monaco, deps)
}

async function start(): Promise<typeof Monaco> {
  // 🛑 Before the first model: Monaco reads this global when it spawns a worker, and a CDN is
  // what it falls back to — which the content security policy refuses, silently and for ever.
  // Cast with a reason: `MonacoEnvironment` is a property of the worker global that Monaco's own
  // types declare on `Window`, and this file compiles against neither.
  ;(self as unknown as { MonacoEnvironment: Monaco.Environment }).MonacoEnvironment = {
    getWorker: (_id: string, label: string) =>
      label === 'typescript' || label === 'javascript' ? new TsWorker() : new EditorWorker(),
  }

  // The ESM entry by its PATH: the package publishes no main a bundler or a test runner
  // resolves, and `editor.main` is the one that brings the TypeScript contribution with it.
  const monaco = await import('monaco-editor/esm/vs/editor/editor.main')
  const typescript = monaco.languages.typescript.typescriptDefaults

  typescript.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    strict: true,
    noEmit: true,
    allowNonTsExtensions: true,
    // What makes a missing hook or a wrong asset name red: nothing else is in scope.
    lib: ['es2020'],
  })
  // Without it a model created after the worker started is typed against an empty world.
  typescript.setEagerModelSync(true)
  typescript.addExtraLib(STUDIO_TYPES, STUDIO_TYPES_PATH)

  return monaco
}
