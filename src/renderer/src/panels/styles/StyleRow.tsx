import { useTranslation } from 'react-i18next'
import type { MaterialStyle } from '@shared/domain/style'
import { Row } from '@/design/Row'
import { InlineRename } from '@/panels/shared/InlineRename'

export type StyleRowProps = {
  style: MaterialStyle
  renaming: boolean
  onRenamed: (name: string) => void
}

/**
 * One saved style. It draws its name and nothing else on purpose: the fifteen values behind it
 * are read by applying it, and a subtitle summarising three of them would be a description that
 * goes stale against the twelve it left out.
 */
export function StyleRow({ style, renaming, onRenamed }: StyleRowProps) {
  const { t } = useTranslation()

  if (renaming) {
    return (
      <div className="flex h-full min-w-0 items-center px-1">
        <InlineRename value={style.name} label={t('styles.rename')} onCommit={onRenamed} />
      </div>
    )
  }

  return <Row title={style.name} />
}
