import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { toolIcon } from '@/helpers/toolRegistry'
import { NoProject } from '@/panels/shared/NoProject'
import { useCode } from '@/stores/code'
import { useProject } from '@/stores/project'
import { CodeHost } from './CodeHost'
import { CodeProblems } from './CodeProblems'
import { CodeTabs } from './CodeTabs'

/** Where a game's own code is written. The chrome is the studio's; only the text area is Monaco. */
export function Code() {
  const { t } = useTranslation()
  const project = useProject(state => state.project)
  const open = useCode(state => state.open)
  const active = useCode(state => state.active)
  // A reference, never a fresh object: a selector that allocates re-runs for ever.
  const file = useCode(state => (state.active === null ? undefined : state.files[state.active]))
  const problems = useCode(state => state.problems)

  // Read once per project: what a Play compiles is the same walk, and a panel opened after one
  // must not show a list from the project before it.
  useEffect(() => {
    if (project) void useCode.getState().reload()
  }, [project])

  if (!project) return <NoProject icon={toolIcon('code')} message={t('code.noProject')} />
  if (active === null || file === undefined) {
    return <EmptyState icon={toolIcon('code')} message={t('code.emptyHint')} />
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CodeTabs open={open} active={active} />
      <div className="min-h-0 flex-1">
        <CodeHost script={active} source={file.source} />
      </div>
      <CodeProblems problems={problems} />
    </div>
  )
}
