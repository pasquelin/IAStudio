import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COMPONENT_TYPES } from '@shared/domain/componentRegistry'
import { EmptyState } from '@/design/EmptyState'
import { loadCodeEditor, type CodeEditor } from '@/engines/code/CodeEditor'
import { projectTypes } from '@/engines/code/projectTypes'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { workspaceById } from '@/helpers/workspaces'
import { isCodeDirty, scriptRefOf, useCode } from '@/stores/code'

export type ScriptDocumentProps = { documentId: string }

/** A script in the centre — invariant 4: Monaco is an engine this mounts and drives, and the text
 * it shows comes from `useCode`, never from what the editor happens to hold. */
export function ScriptDocument({ documentId }: ScriptDocumentProps) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<CodeEditor | null>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  useRestoredDocument(documentId)
  const script = scriptRefOf(documentId)
  const revision = useCode(state => state.revision)
  useDocumentTitle(
    documentId,
    useCode(state => (script === null ? false : isCodeDirty(state.files[script]))),
  )
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
        held.declareProject(PROJECT_TYPES)
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
      // The markers are read off a LIVE editor, so a list kept past the last one names scripts
      // no tab holds and no event will ever correct. Another open tab republishes its own.
      useCode.getState().noted([])
    }
  }, [])

  // 🛑 On `revision`, never on the text: the store is written by every keystroke, and pushing it
  // back sends the editor a version one gesture behind — which undoes what was just typed, drops
  // the selection and moves the caret. Only a write from OUTSIDE bumps this.
  useEffect(() => {
    if (!ready || script === null) return
    editor.current?.show(script, useCode.getState().files[script]?.source ?? '')
  }, [ready, script, revision])

  useEffect(() => {
    if (!goto || goto.script !== script || !ready) return
    editor.current?.reveal(goto.line, goto.column)
    useCode.getState().arrived()
  }, [goto, script, ready])

  if (failed) {
    return <EmptyState icon={workspaceById('code').icon} message={t('code.unavailable')} />
  }
  return <div ref={host} className="h-full min-h-0 w-full" data-sc="section:code.editor" />
}

/** Computed once: the names come from the component registry, which is a constant of the build. */
const PROJECT_TYPES = projectTypes({ components: COMPONENT_TYPES })
