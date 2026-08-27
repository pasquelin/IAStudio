import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { loadCodeEditor, type CodeEditor } from '@/engines/code/CodeEditor'
import { projectTypes } from '@/engines/code/projectTypes'
import { toolIcon } from '@/helpers/toolRegistry'
import { useLatest } from '@/hooks/useLatest'
import { COMPONENT_TYPES } from '@shared/domain/componentRegistry'
import { useCode } from '@/stores/code'

export type CodeHostProps = {
  /** The script shown right now. Its text comes from the store, never from the editor. */
  script: string
  source: string
}

/** Where Monaco is mounted — invariant 4. Built ONCE: rebuilding it costs eighteen megabytes. */
export function CodeHost({ script, source }: CodeHostProps) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<CodeEditor | null>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const shown = useLatest({ script, source })
  const goto = useCode(state => state.goto)

  useEffect(() => {
    const where = host.current
    if (!where) return

    let dropped = false
    const start = async (): Promise<void> => {
      try {
        const held = await loadCodeEditor({
          host: where,
          onChanged: (one, text) => useCode.getState().edited(one, text),
          onProblems: problems => useCode.getState().noted(problems),
        })
        if (dropped) return held.dispose()
        editor.current = held
        held.declareProject(projectTypes(namesOfProject()))
        held.show(shown.current.script, shown.current.source)
        setReady(true)
      } catch {
        // Said on screen rather than swallowed: an editor that never appears is the one failure
        // an author cannot work around.
        if (!dropped) setFailed(true)
      }
    }
    void start()

    return () => {
      dropped = true
      editor.current?.dispose()
      editor.current = null
      setReady(false)
    }
  }, [shown])

  useEffect(() => {
    editor.current?.show(script, source)
  }, [script, source])

  // 🛑 Kept until Monaco is THERE: the first open loads eighteen megabytes, and a `goto` cleared
  // while the editor is still null is a cursor that never goes to the line somebody clicked.
  useEffect(() => {
    if (!goto || goto.script !== script || !ready) return
    editor.current?.reveal(goto.line, goto.column)
    useCode.getState().arrived()
  }, [goto, script, ready])

  if (failed) {
    return <EmptyState icon={toolIcon('code')} message={t('code.unavailable')} />
  }
  return <div ref={host} className="h-full min-h-0 w-full" data-sc="section:code.editor" />
}

/** What the project declares, for the completion. One family until a lot fills another. */
const namesOfProject = () => ({ components: COMPONENT_TYPES })
