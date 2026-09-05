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

/** Static because Tailwind does not generate class names composed from template counts. */
const LAYOUT: Record<SceneTemplateGroup, { section: string; columns: string }> = {
  general: { section: 'col-span-6', columns: 'grid-cols-6' },
  character: { section: 'col-span-3 col-start-1', columns: 'grid-cols-3' },
  machine: { section: 'col-span-2', columns: 'grid-cols-2' },
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
        <section key={group} className={cn('flex min-w-0 flex-col gap-1.5', LAYOUT[group].section)}>
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
