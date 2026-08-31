import { mdiPlus } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import {
  blankCard,
  CONTEXT_CARDS_MAX,
  CONTEXT_TEMPLATES,
  withCard,
  type ContextCard,
} from '@shared/domain/projectContext'
import { MenuButton } from '@/components/MenuButton'
import { MenuRow } from '@/components/MenuRow'
import { newId } from '@/helpers/ids'
import { HINT_RIGHT, TIP_BOTTOM } from '@/helpers/tooltip'
import { useProjectContext } from '@/stores/projectContext'

/** Adds a card. The models are a way IN and never a schema: what they write is then rewritten. */
export function ContextActions() {
  const { t } = useTranslation()
  const context = useProjectContext(state => state.context)
  const write = useProjectContext(state => state.write)

  const add = (fields: Partial<ContextCard>): void => {
    void write(withCard(context.cards, { ...blankCard(newId()), ...fields }))
  }

  return (
    <MenuButton
      icon={mdiPlus}
      label={t('context.add')}
      description={t('context.addHint')}
      tooltip={TIP_BOTTOM}
      disabled={context.trouble !== null || context.cards.length >= CONTEXT_CARDS_MAX}
      opensOnClick
      rowCount={CONTEXT_TEMPLATES.length + 1}
      rows={close => (
        <>
          <MenuRow
            label={t('context.templateBlank')}
            tip={HINT_RIGHT(t('context.templateBlankHint'))}
            onSelect={() => {
              add({})
              close()
            }}
          />
          {CONTEXT_TEMPLATES.map(template => (
            <MenuRow
              key={template.id}
              label={t(template.titleKey)}
              // The body IS the hint: what a model writes is what one wants to know before
              // picking it, and repeating the title would be noise to a screen reader.
              tip={HINT_RIGHT(t(template.bodyKey))}
              onSelect={() => {
                add({ title: t(template.titleKey), body: t(template.bodyKey) })
                close()
              }}
            />
          ))}
        </>
      )}
    />
  )
}
