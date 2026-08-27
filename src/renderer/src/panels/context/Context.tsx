import { useTranslation } from 'react-i18next'
import {
  blankCard,
  composedContext,
  CONTEXT_COMPOSED_MAX,
  droppedCards,
  withCard,
  withoutCard,
} from '@shared/domain/projectContext'
import { EmptyState } from '@/design/EmptyState'
import { PANEL_SCROLL } from '@/design/styles'
import { newId } from '@/helpers/ids'
import { toolIcon } from '@/helpers/toolRegistry'
import { NoProject } from '@/panels/shared/NoProject'
import { useProject } from '@/stores/project'
import { useProjectContext } from '@/stores/projectContext'
import { ContextCardRow } from './ContextCardRow'

/** Every gesture stores the WHOLE list, which is what keeps every window on the same file. */
export function Context() {
  const { t } = useTranslation()
  const project = useProject(state => state.project)
  const context = useProjectContext(state => state.context)
  const loaded = useProjectContext(state => state.loaded)
  const write = useProjectContext(state => state.write)
  const dropped = useProjectContext(state => droppedCards(state.context.cards))

  if (!project) return <NoProject icon={toolIcon('context')} message={t('context.noProject')} />

  // Before the file has answered, and NOT belt and braces: an unread context is `noContext()`,
  // which is also an empty one, and the way in below rewrites the file whole — offered a moment
  // too early, one click replaces a project's real cards with a blank one, with no undo.
  if (!loaded) {
    return <EmptyState icon={toolIcon('context')} message={t('collection.loading')} />
  }

  // Said rather than shown empty: the file is there, this build will not touch it, and which of
  // the two troubles it is decides what the reader does next.
  if (context.trouble !== null) {
    return (
      <EmptyState
        icon={toolIcon('context')}
        message={context.trouble === 'too-new' ? t('context.tooNew') : t('context.unreadable')}
      />
    )
  }

  if (context.cards.length === 0) {
    return (
      <EmptyState
        icon={toolIcon('context')}
        message={t('context.emptyHint')}
        action={{
          label: t('context.addFirst'),
          hint: t('context.addFirstHint'),
          onClick: () => void write(withCard(context.cards, blankCard(newId()))),
        }}
      />
    )
  }

  return (
    <div className={PANEL_SCROLL}>
      {context.cards.map(card => (
        <ContextCardRow
          // 🛑 The TEXTS are in the key, not just the id: the row holds what is being typed in a
          // state of its own, and another window — or an MCP client — rewriting a card would
          // otherwise leave this one showing the words from before, and store them back on blur.
          key={`${card.id}:${card.title}:${card.body}`}
          card={card}
          onChange={edited => void write(withCard(context.cards, edited))}
          onRemove={() => void write(withoutCard(context.cards, card.id))}
        />
      ))}

      {/* The bound is the MODEL's, not the studio's. A card past it is dropped WHOLE, and said
          rather than dropped in silence: a card left on that reaches no model is the one defect
          this panel exists to prevent. */}
      <p className="text-muted text-tiny p-2">
        {t('context.used', {
          used: composedContext(context.cards).length,
          max: CONTEXT_COMPOSED_MAX,
        })}
        {dropped > 0 && <span className="text-danger block">{t('context.over')}</span>}
      </p>
    </div>
  )
}
