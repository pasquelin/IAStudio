import { mdiClose } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { assetUrl } from '@shared/domain/asset'
import { Row } from '@/design/Row'
import { PANEL_GROUP_LABEL } from '@/design/styles'
import { Thumbnail } from '@/design/Thumbnail'
import { ToolButton } from '@/design/ToolButton'
import { TIP_LEFT } from '@/helpers/tooltip'
import {
  isWithdrawable,
  type GenerationInput,
  type WithdrawableInput,
} from '@/generation/generationInputs'

export type GeneratorSourcesProps = {
  inputs: readonly GenerationInput[]
  /** Takes one input back off. See `GenerationContext.withdraw` for what that undoes. */
  onWithdraw: (input: WithdrawableInput) => void
}

/**
 * 🛑 What the workspace is about to hand the model, drawn. The panel takes it on its own, so what
 * it took has to be readable before the button is pressed — a source nobody can see is a resource
 * spent without being asked for.
 *
 * Each line says WHERE it was picked and offers the way off, for the same reason: the shelf it was
 * taken from can be a closed panel, and a source one can neither trace nor withdraw is one that
 * spends on the next press whatever the person meant.
 */
export function GeneratorSources({ inputs, onWithdraw }: GeneratorSourcesProps) {
  const { t } = useTranslation()
  if (inputs.length === 0) return null

  return (
    <section className="flex flex-col gap-1.5" data-sc="section:generation.sources">
      <h3 className={PANEL_GROUP_LABEL}>{t('generation.sources')}</h3>

      <ul className="flex flex-col gap-1.5">
        {inputs.map(input => (
          // Named by what WITHDRAWING it undoes — the placement for a scene, the row otherwise.
          // Two placements of one model shared a key, so taking one off remounted the other's
          // thumbnail and made it fetch its picture again.
          <li key={input.origin === 'scene' ? input.nodeId : `${input.assetId}:${input.origin}`}>
            <Row
              media={
                input.assetId ? (
                  <Thumbnail url={assetUrl(input.assetId)} />
                ) : (
                  <span className="bg-elevated size-full rounded-(--radius-sc-sm)" />
                )
              }
              title={input.label}
              subtitle={t(`generation.sourceFrom_${input.origin}`)}
              actions={
                !isWithdrawable(input) ? undefined : (
                  <ToolButton
                    icon={mdiClose}
                    variant="row"
                    acts
                    label={t('generation.dropSource')}
                    description={t('generation.dropSourceHint')}
                    tooltip={TIP_LEFT}
                    onClick={() => onWithdraw(input)}
                  />
                )
              }
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
