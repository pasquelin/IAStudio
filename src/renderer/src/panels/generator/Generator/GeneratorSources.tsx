import { useTranslation } from 'react-i18next'
import { assetUrl } from '@shared/domain/asset'
import { Row } from '@/design/Row'
import { PANEL_GROUP_LABEL } from '@/design/styles'
import { Thumbnail } from '@/design/Thumbnail'
import type { GenerationInput } from '@/generation/generationInputs'

export type GeneratorSourcesProps = {
  inputs: readonly GenerationInput[]
}

/**
 * 🛑 What the workspace is about to hand the model, drawn. The panel takes the selection and the
 * open document on its own, so what it took has to be readable before the button is pressed — a
 * source nobody can see is a resource spent without being asked for.
 */
export function GeneratorSources({ inputs }: GeneratorSourcesProps) {
  const { t } = useTranslation()
  if (inputs.length === 0) return null

  return (
    <section className="flex flex-col gap-1.5 px-2 pt-2" data-sc="section:generation.sources">
      <h3 className={PANEL_GROUP_LABEL}>{t('generation.sources')}</h3>

      <ul className="flex flex-col gap-1.5">
        {inputs.map((input, at) => (
          // Rebuilt from the workspace on every change and holding no state, so the position is
          // the only stable name a live document's input ever has.
          <li key={`${input.role}:${input.assetId ?? input.label}:${at}`}>
            <Row
              media={
                input.assetId ? (
                  <Thumbnail url={assetUrl(input.assetId)} className="size-(--sc-control)" />
                ) : (
                  <span className="bg-elevated size-(--sc-control) rounded-(--radius-sc-sm)" />
                )
              }
              title={input.label}
              subtitle={t(`generation.sourceFrom_${input.origin}`)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
