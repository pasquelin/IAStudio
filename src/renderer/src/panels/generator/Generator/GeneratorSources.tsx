import { useTranslation } from 'react-i18next'
import { assetUrl } from '@shared/domain/asset'
import { PANEL_GROUP_LABEL } from '@/design/styles'
import { Thumbnail } from '@/design/Thumbnail'
import type { GenerationInput } from '@/generation/generationInputs'

export type GeneratorSourcesProps = {
  inputs: readonly GenerationInput[]
}

/**
 * What the workspace is about to hand the model, drawn — the § 10 of the brief.
 *
 * 🛑 Never a silent generation: the panel takes the selection and the open document on its own,
 * so what it took has to be readable before the button is pressed. A source nobody can see is a
 * resource spent without being asked for.
 */
export function GeneratorSources({ inputs }: GeneratorSourcesProps) {
  const { t } = useTranslation()
  if (inputs.length === 0) return null

  return (
    <section className="flex flex-col gap-1.5 px-2 pt-2" data-sc="section:generation.sources">
      <h3 className={PANEL_GROUP_LABEL}>{t('generation.sources')}</h3>

      <ul className="flex flex-col gap-1.5">
        {inputs.map((input, at) => (
          <li
            // The list is rebuilt from the workspace on every change and holds no state of its
            // own, so the position is the only stable name a live document's input ever has.
            key={`${input.role}:${input.assetId ?? input.label}:${at}`}
            className="bg-surface flex min-w-0 items-center gap-2 rounded-(--radius-sc-sm) p-1"
          >
            {input.assetId ? (
              <Thumbnail url={assetUrl(input.assetId)} className="size-8 shrink-0" />
            ) : (
              <span className="bg-elevated size-8 shrink-0 rounded-(--radius-sc-sm)" />
            )}

            <span className="flex min-w-0 flex-col">
              <span className="text-text truncate text-xs">{input.label}</span>
              <span className="text-muted text-tiny">
                {t(`generation.sourceFrom_${input.origin}`)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
