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
  /** Handed the way to move the cursor, so a problems row can open its own line. */
  reveal: (open: (at: { line: number; column: number }) => void) => void
}

/**
 * Where Monaco is mounted, and the only place React touches it — invariant 4.
 *
 * 🛑 Built ONCE per panel and fed from the store afterwards. Rebuilding it on every change would
 * cost eight megabytes of worker and an author's undo history along with it.
 */
export function CodeHost({ script, source, reveal }: CodeHostProps) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<CodeEditor | null>(null)
  const [failed, setFailed] = useState(false)
  const shown = useLatest({ script, source })
  const told = useLatest(reveal)
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
        told.current(at => held.reveal(at.line, at.column))
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
    }
  }, [shown, told])

  useEffect(() => {
    editor.current?.show(script, source)
  }, [script, source])

  useEffect(() => {
    if (!goto || goto.script !== script) return
    editor.current?.reveal(goto.line, goto.column)
    useCode.getState().arrived()
  }, [goto, script])

  if (failed) {
    return <EmptyState icon={toolIcon('code')} message={t('code.unavailable')} />
  }
  return <div ref={host} className="h-full min-h-0 w-full" data-sc="section:code.editor" />
}

/** What the project declares, for the completion. Widened until the lot that fills it in. */
const namesOfProject = () => ({
  scenes: [],
  prefabs: [],
  entities: [],
  components: COMPONENT_TYPES,
  events: [],
})
