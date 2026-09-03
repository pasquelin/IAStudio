import {
  mdiAirplane,
  mdiAutoFix,
  mdiCarHatchback,
  mdiCubeOutline,
  mdiEyeOutline,
  mdiGrid,
  mdiGridLarge,
  mdiHomeOutline,
  mdiMovieOpenOutline,
  mdiSpotlightBeam,
  mdiVideoOutline,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import {
  SCENE_TEMPLATE_GROUPS,
  TEMPLATES_BY_GROUP,
  templateThumbnailUrl,
  type SceneTemplateGroup,
  type SceneTemplateId,
} from '@shared/domain/sceneTemplate'
import { cn } from '@/helpers/cn'
import { NewDocumentTemplateTile } from './NewDocumentTemplateTile'

/** The glyph a template falls back on until its still has been drawn. */
const ICONS: Record<SceneTemplateId, string> = {
  empty: mdiCubeOutline,
  basic: mdiGridLarge,
  photoStudio: mdiSpotlightBeam,
  cinematic: mdiMovieOpenOutline,
  archvis: mdiHomeOutline,
  postProcessing: mdiAutoFix,
  firstPerson: mdiEyeOutline,
  thirdPerson: mdiVideoOutline,
  topDown: mdiGrid,
  car: mdiCarHatchback,
  plane: mdiAirplane,
}

/**
 * How each group is laid out: how many of the section's ELEVEN columns it takes, and how many
 * tiles it fits across — always as many as the group holds, so every group is one row, and the
 * three spans add up to the section's own width so every tile is one column wide whichever group
 * it is in. A group gaining a template moves both numbers, here and on the row below.
 *
 * Written rather than composed from that count, because Tailwind generates its classes by
 * reading the source: `grid-cols-${templates.length}` produces a class that does not exist.
 * `NewDocumentTemplates.test.tsx` holds the two halves together.
 */
const LAYOUT: Record<SceneTemplateGroup, { span: string; columns: string }> = {
  general: { span: 'col-span-6', columns: 'grid-cols-6' },
  character: { span: 'col-span-3', columns: 'grid-cols-3' },
  machine: { span: 'col-span-2', columns: 'grid-cols-2' },
}

export type NewDocumentTemplatesProps = {
  value: SceneTemplateId
  onChange: (id: SceneTemplateId) => void
}

/**
 * What a scene opens on, picked before it is made — a floor and a camera, a photo set, a shot on
 * a rail.
 *
 * Only the scene kind draws this: the other five have one thing to be. Its state is
 * `aria-pressed`, like every other exclusive row of this studio (see `Chip`), and each tile
 * carries a `data-sc` so a script can pick one without reading a translated word.
 */
export function NewDocumentTemplates({ value, onChange }: NewDocumentTemplatesProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-11 gap-3">
      {SCENE_TEMPLATE_GROUPS.map(group => (
        <section key={group} className={cn('flex min-w-0 flex-col gap-1.5', LAYOUT[group].span)}>
          <span className="text-muted text-xs">{t(`documents.templateGroups.${group}`)}</span>
          <ul className={cn('grid gap-2', LAYOUT[group].columns)}>
            {TEMPLATES_BY_GROUP[group].map(id => (
              <li key={id}>
                <NewDocumentTemplateTile
                  id={id}
                  caption={t(`documents.templates.${id}`)}
                  hint={t(`documents.templateHints.${id}`)}
                  icon={ICONS[id]}
                  url={templateThumbnailUrl(id)}
                  selected={value === id}
                  onPick={() => onChange(id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
