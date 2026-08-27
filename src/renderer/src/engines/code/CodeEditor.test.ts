import type * as Monaco from 'monaco-editor'
import { describe, expect, it } from 'vitest'
import { CodeEditor } from './CodeEditor'

type FakeModel = {
  uri: string
  value: string
  disposed: boolean
  getValue: () => string
  getFullModelRange: () => null
  pushEditOperations: () => null
  dispose: () => void
}

/**
 * Monaco stood in for, because the real one is eighteen megabytes and a DOM: what these cases
 * assert is the façade's own bookkeeping — which model is made, which is adopted, which is
 * dropped — and none of that reaches the editor widget.
 */
function fakeMonaco() {
  const models = new Map<string, FakeModel>()

  const monaco = {
    Uri: { parse: (uri: string) => ({ toString: () => uri, path: uri.replace('file://', '') }) },
    MarkerSeverity: { Warning: 4, Error: 8 },
    editor: {
      defineTheme: () => undefined,
      setTheme: () => undefined,
      getModelMarkers: () => [],
      onDidChangeMarkers: () => ({ dispose: () => undefined }),
      create: () => ({
        onDidChangeModelContent: () => ({ dispose: () => undefined }),
        getModel: () => null,
        setModel: () => undefined,
        revealPositionInCenter: () => undefined,
        setPosition: () => undefined,
        focus: () => undefined,
        dispose: () => undefined,
      }),
      getModel: (uri: { toString: () => string }) => models.get(uri.toString()) ?? null,
      createModel: (value: string, _language: string, uri: { toString: () => string }) => {
        const key = uri.toString()
        if (models.has(key)) throw new Error(`model already exists: ${key}`)
        const model: FakeModel = {
          uri: key,
          value,
          disposed: false,
          getValue: () => model.value,
          getFullModelRange: () => null,
          pushEditOperations: () => null,
          dispose: () => {
            model.disposed = true
          },
        }
        models.set(key, model)
        return model
      },
    },
    languages: {
      typescript: { typescriptDefaults: { addExtraLib: () => ({ dispose: () => undefined }) } },
    },
  }

  return { models, monaco: monaco as unknown as typeof Monaco }
}

const editorOn = (monaco: typeof Monaco): CodeEditor =>
  new CodeEditor(monaco, {
    host: {} as HTMLElement,
    onChanged: () => undefined,
    onProblems: () => undefined,
  })

/** A path per case: the model map is MODULE-wide, so two cases on one path share its count. */
let next = 0
const aScript = (): string => `script:scripts/Walk-${(next += 1)}.ts`

describe('an editor showing a script', () => {
  /**
   * 🛑 `createModel` THROWS on a URI already taken, and a tab is one editor: a remount got there
   * before the outgoing editor had disposed its own. The throw landed in a mount effect nothing
   * catches, and what stayed on screen was an editor no keystroke reached.
   */
  it('shows a second editor the one model of that path rather than making another', () => {
    const { models, monaco } = fakeMonaco()
    const script = aScript()
    editorOn(monaco).show(script, 'one')

    expect(() => editorOn(monaco).show(script, 'one')).not.toThrow()
    expect(models.size).toBe(1)
  })

  /** The model belongs to the PATH: whoever made it, the one still showing it keeps it alive. */
  it('leaves the model alive while another editor is still on it', () => {
    const { models, monaco } = fakeMonaco()
    const script = aScript()
    const first = editorOn(monaco)
    first.show(script, 'one')
    const second = editorOn(monaco)
    second.show(script, 'one')

    first.dispose()

    expect([...models.values()][0]?.disposed).toBe(false)
  })

  /** And goes with the last of them — a model left behind keeps feeding `problems()`. */
  it('drops the model once no editor holds it', () => {
    const { models, monaco } = fakeMonaco()
    const script = aScript()
    const only = editorOn(monaco)
    only.show(script, 'one')

    only.dispose()

    expect([...models.values()][0]?.disposed).toBe(true)
  })
})
