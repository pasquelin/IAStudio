import { useTranslation } from 'react-i18next'
import type { GitRef } from '@shared/domain/git'
import { cn } from '@/helpers/cn'

/**
 * How each kind of name reads.
 *
 * A TAG is the one that catches the eye, and deliberately: a branch says where work is happening
 * and a remote branch where the server had got to, but a tag is a DECISION somebody made — a
 * delivery, a version shown to a client — and it is the one a person scrolls a history looking
 * for.
 */
const KINDS: Record<GitRef['kind'], string> = {
  tag: 'bg-accent text-accent-content',
  branch: 'border-border text-text border',
  remote: 'border-border text-muted border',
}

/** One name pointing at a commit, drawn on its row. */
export function RefBadge({ reference }: { reference: GitRef }) {
  const { t } = useTranslation()

  return (
    <span
      title={t(`git.ref.${reference.kind}`)}
      className={cn(
        'text-tiny shrink-0 rounded-(--radius-sc-sm) px-1 whitespace-nowrap',
        KINDS[reference.kind],
      )}
    >
      {reference.name}
    </span>
  )
}
