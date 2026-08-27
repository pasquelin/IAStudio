import { useTranslation } from 'react-i18next'
import type { CodeProblem } from '@/engines/code/CodeEditor'
import { cn } from '@/helpers/cn'
import { useCode } from '@/stores/code'

export type CodeProblemsProps = {
  problems: readonly CodeProblem[]
  /** Told where to go. The editor is what actually moves the cursor. */
  onOpen: (problem: CodeProblem) => void
}

/**
 * What the type worker has to say, over every open script.
 *
 * 🛑 This is the whole promise of the lot: a wrong asset name is RED here before anything runs,
 * and one click puts the cursor on it.
 */
export function CodeProblems({ problems, onOpen }: CodeProblemsProps) {
  const { t } = useTranslation()

  if (problems.length === 0) {
    return (
      <p className="text-muted text-tiny border-line border-t px-2 py-1">{t('code.noProblems')}</p>
    )
  }

  return (
    <ul className="border-line max-h-40 shrink-0 overflow-y-auto border-t">
      {problems.map(problem => (
        <li key={`${problem.script}:${problem.line}:${problem.column}:${problem.message}`}>
          <button
            type="button"
            className="hover:bg-elevated flex w-full items-baseline gap-2 px-2 py-1 text-left"
            data-sc="field:code.problem"
            title={t('code.openProblem')}
            onClick={() => {
              useCode.getState().show(problem.script)
              onOpen(problem)
            }}
          >
            <span
              className={cn(
                'text-tiny',
                problem.severity === 'error' ? 'text-danger' : 'text-warning',
              )}
            >
              ●
            </span>
            <span className="text-small min-w-0 flex-1 truncate">{problem.message}</span>
            <span className="text-muted text-tiny whitespace-nowrap">
              {t('code.at', { line: problem.line, column: problem.column })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
