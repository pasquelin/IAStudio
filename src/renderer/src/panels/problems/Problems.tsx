import { useTranslation } from 'react-i18next'
import { rowSkin } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { openScriptAt } from '@/helpers/openScript'
import { useCode } from '@/stores/code'

/** What the type worker has to say, over every script of the project. One click opens the line. */
export function Problems() {
  const { t } = useTranslation()
  const problems = useCode(state => state.problems)

  if (problems.length === 0) {
    return <p className="text-muted text-tiny px-2 py-1">{t('code.noProblems')}</p>
  }

  return (
    <ul className="h-full overflow-y-auto">
      {problems.map(problem => (
        <li key={`${problem.script}:${problem.line}:${problem.column}:${problem.message}`}>
          <button
            type="button"
            className={cn(rowSkin(false), 'flex w-full items-baseline gap-2 px-2 py-1 text-left')}
            data-sc="field:code.problem"
            title={t('code.openProblem')}
            onClick={() => openScriptAt(problem.script, problem.line, problem.column)}
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
