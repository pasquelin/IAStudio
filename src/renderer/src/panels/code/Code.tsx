import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { toolIcon } from '@/helpers/toolRegistry'
import { NoProject } from '@/panels/shared/NoProject'
import { codeFilesOf, useCode } from '@/stores/code'
import { useProject } from '@/stores/project'
import { CodeHost } from './CodeHost'
import { CodeProblems } from './CodeProblems'
import { CodeTabs } from './CodeTabs'

/**
 * Where a game's own code is written.
 *
 * The chrome is the studio's — tabs, problems, empty states — and only the text area is Monaco,
 * which `CLAUDE.md` treats as an engine rather than as a panel control.
 */
export function Code() {
  const { t } = useTranslation()
  const project = useProject(state => state.project)
  const files = useCode(codeFilesOf)
  const open = useCode(state => state.open)
  const active = useCode(state => state.active)
  const problems = useCode(state => state.problems)
  const reveal = useRef<((at: { line: number; column: number }) => void) | null>(null)

  // Read once per project: what a Play compiles is the same walk, and a panel opened after one
  // must not show a list from the project before it.
  useEffect(() => {
    if (project) void useCode.getState().reload()
  }, [project])

  if (!project) return <NoProject icon={toolIcon('code')} message={t('code.noProject')} />
  if (files.length === 0) {
    return <EmptyState icon={toolIcon('code')} message={t('code.emptyHint')} />
  }

  const shown = active ?? files[0]?.script ?? null
  const source = shown === null ? '' : (useCode.getState().files[shown]?.source ?? '')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CodeTabs
        open={open.length > 0 ? open : files.slice(0, 1).map(one => one.script)}
        active={shown}
      />
      <div className="min-h-0 flex-1">
        {shown !== null && (
          <CodeHost
            script={shown}
            source={source}
            reveal={open => {
              reveal.current = open
            }}
          />
        )}
      </div>
      <CodeProblems problems={problems} onOpen={problem => reveal.current?.(problem)} />
    </div>
  )
}
