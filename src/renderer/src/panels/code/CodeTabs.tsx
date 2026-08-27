import { useMemo } from 'react'
import { mdiClose } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { ToolButton } from '@/design/ToolButton'
import { isCodeDirty, useCode } from '@/stores/code'

export type CodeTabsProps = {
  open: readonly string[]
  active: string | null
}

/** One tab per open script. The dot is the unsaved mark every editor draws. */
export function CodeTabs({ open, active }: CodeTabsProps) {
  const { t } = useTranslation()
  // 🛑 Neither selector allocates: zustand re-runs one that answers a fresh object for ever.
  const files = useCode(state => state.files)
  const problems = useCode(state => state.problems)
  const dirty = useMemo(
    () => new Set(open.filter(script => isCodeDirty(files[script]))),
    [files, open],
  )
  // On the TAB and not only in the list: a script whose error is three tabs away is an error
  // nobody sees until a Play refuses to run it.
  const wrong = useMemo(
    () =>
      new Set(
        problems.filter(problem => problem.severity === 'error').map(problem => problem.script),
      ),
    [problems],
  )

  return (
    <div className="border-line flex min-h-0 shrink-0 items-stretch gap-px overflow-x-auto border-b">
      {open.map(script => (
        <div
          key={script}
          className={cn(
            'flex items-center gap-2 pr-1 pl-2',
            script === active ? 'bg-accent-soft' : 'bg-panel hover:bg-elevated',
          )}
        >
          <button
            type="button"
            className="text-small py-1 whitespace-nowrap"
            data-sc={`field:code.tab.${script}`}
            onClick={() => useCode.getState().show(script)}
          >
            <span className={wrong.has(script) ? 'text-danger' : undefined}>{nameOf(script)}</span>
            {dirty.has(script) && <span className="text-accent-ink ml-1">•</span>}
          </button>
          <ToolButton
            icon={mdiClose}
            label={t('code.close')}
            tooltip={TIP_BOTTOM}
            onClick={() => useCode.getState().close(script)}
          />
        </div>
      ))}
    </div>
  )
}

/** The file, not its folder: a tab is read at a glance and the path is on the breadcrumb. */
const nameOf = (script: string): string =>
  script
    .replace(/^script:/, '')
    .split('/')
    .at(-1) ?? script
