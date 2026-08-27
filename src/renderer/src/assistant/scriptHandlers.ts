import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { SCRIPT_EXTENSION } from '@shared/domain/game'
import { refToString } from '@shared/domain/ref'
import { transpile } from '@/engines/code/transpile'
import { codeFilesOf, useCode } from '@/stores/code'
import { useProject } from '@/stores/project'
import type { ActionHandlers } from './actionHandler'
import { textOf } from './actionInputs'

/**
 * The `.ts` files a game runs, read and written from outside the window.
 *
 * 🛑 Through the EDITOR's own store, never the bridge directly: a script the panel is holding
 * unsaved would otherwise be read from disk as it was before, and written over without a word.
 * The refusal of a path that leaves the project is the main process's, and stays there.
 */

const noProject = (): ActionOutcome | null =>
  useProject.getState().project === null ? refused('wrongSurface', 'no project open') : null

export const SCRIPT_HANDLERS: ActionHandlers = {
  'script.list': async () => {
    const shut = noProject()
    if (shut) return shut

    await useCode.getState().reload()
    return {
      ok: true,
      data: {
        scripts: codeFilesOf(useCode.getState()).map(file => ({
          ref: file.script,
          path: file.script.replace(/^script:/, ''),
          lines: file.source.split('\n').length,
        })),
      },
    }
  },

  'script.read': async input => {
    const shut = noProject()
    if (shut) return shut

    const path = textOf(input, 'path') ?? ''
    await useCode.getState().reload()
    const held = useCode.getState().files[refToString({ kind: 'script', path })]
    if (!held) return refused('notFound', `no script "${path}" in this project`)

    return { ok: true, data: { ref: held.script, source: held.source } }
  },

  'script.write': async input => {
    const shut = noProject()
    if (shut) return shut

    const path = textOf(input, 'path') ?? ''
    if (!path.endsWith(SCRIPT_EXTENSION)) {
      return refused('badInput', `a script is a ${SCRIPT_EXTENSION} file, not "${path}"`)
    }
    const source = textOf(input, 'source') ?? ''

    // 🛑 Refused BEFORE it lands, with the line: a file that will not compile is one the next
    // Play would refuse anyway, and a model told `ok` has no reason to look at it again.
    const held = transpile(source)
    if ('trouble' in held) {
      return refused('badInput', `line ${held.line}: cannot import ${held.trouble}`)
    }

    const script = refToString({ kind: 'script', path })
    useCode.setState(state => ({
      files: {
        ...state.files,
        [script]: { script, saved: state.files[script]?.saved ?? '', source },
      },
    }))
    if (!(await useCode.getState().save(script))) {
      return refused('badInput', `"${path}" is not a script of this project`)
    }
    return { ok: true, data: { ref: script } }
  },
}
