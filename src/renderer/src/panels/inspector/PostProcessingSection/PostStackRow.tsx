import { mdiContentCopy, mdiRestore, mdiTrashCanOutline } from '@mdi/js'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { POST_EFFECTS, type PostEffect } from '@shared/domain/postProcessing'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { Row } from '@/design/Row'
import { ToolButton } from '@/design/ToolButton'
import { ROW_WRAPPER } from '@/design/styles'
import { HINT_RIGHT, TIP_RIGHT } from '@/helpers/tooltip'

export type PostStackRowProps = {
  effect: PostEffect
  /** True where the plan leaves this one out — a second occlusion, a second scene pass. */
  skipped: boolean
  onRemove: () => void
  onDuplicate: () => void
  onReset: () => void
}

/**
 * One effect of the stack.
 *
 * The chevron, the indent, the selection and the drag belong to `Tree`, which owns the geometry
 * of every stack in the studio — the same bargain `LayerRow` strikes. What is drawn here is the
 * name, what the effect costs, and the two things one does to it.
 */
export const PostStackRow = memo(function PostStackRow({
  effect,
  skipped,
  onRemove,
  onDuplicate,
  onReset,
}: PostStackRowProps) {
  const { t } = useTranslation()
  const meta = POST_EFFECTS[effect.effect]

  return (
    <div className={ROW_WRAPPER}>
      <Row
        title={t(`postfx.effect_${effect.effect}`)}
        // Struck through and quiet, exactly as a hidden layer reads: an effect the plan leaves
        // out is not off — its switch says on — so the row has to say why nothing is happening.
        muted={skipped || !effect.enabled}
        suffix={t(`postfx.cost_${meta.cost}`)}
        hint={skipped ? t('postfx.skippedHint') : undefined}
        actions={
          <>
            <ToolButton
              icon={mdiTrashCanOutline}
              label={t('postfx.remove')}
              tooltip={TIP_RIGHT}
              variant="row"
              // Both, as `VisibilityToggle` does: `Tree` arms a row on POINTER DOWN, so stopping
              // the click alone would let a delete select the row it is about to take away.
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation()
                onRemove()
              }}
            />
            <MenuButton
              icon={mdiContentCopy}
              label={t('postfx.duplicate')}
              description={t('postfx.duplicateHint')}
              tooltip={TIP_RIGHT}
              variant="row"
              rowCount={2}
              opensOnClick
              rows={close => (
                <>
                  <MenuRow
                    label={t('postfx.duplicate')}
                    icon={mdiContentCopy}
                    // Refused where a second instance means nothing — one anti-aliaser, one
                    // occlusion. The catalogue answers it, never this row.
                    disabled={!meta.duplicable}
                    tip={HINT_RIGHT(t('postfx.duplicateHint'))}
                    onSelect={() => {
                      close()
                      onDuplicate()
                    }}
                  />
                  <MenuRow
                    label={t('postfx.reset')}
                    icon={mdiRestore}
                    tip={HINT_RIGHT(t('postfx.reset'))}
                    onSelect={() => {
                      close()
                      onReset()
                    }}
                  />
                </>
              )}
            />
          </>
        }
      />
    </div>
  )
})
