import {
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
import { MediaTile } from '@/design/MediaTile'
import { cn } from '@/helpers/cn'
import { HINT_BOTTOM } from '@/helpers/tooltip'

/** The glyph a template falls back on until its still has been drawn. */
const ICONS: Record<SceneTemplateId, string> = {
  empty: mdiCubeOutline,
  basic: mdiGridLarge,
  photoStudio: mdiSpotlightBeam,
  cinematic: mdiMovieOpenOutline,
  archvis: mdiHomeOutline,
  firstPerson: mdiEyeOutline,
  thirdPerson: mdiVideoOutline,
  topDown: mdiGrid,
}

/** How wide each group's row is, out of the eight columns the section is divided into. */
const SPANS: Record<SceneTemplateGroup, string> = {
  general: 'col-span-5',
  character: 'col-span-3',
}

const COLUMNS: Record<SceneTemplateGroup, string> = {
  general: 'grid-cols-5',
  character: 'grid-cols-3',
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
    <div className="grid grid-cols-8 gap-3">
      {SCENE_TEMPLATE_GROUPS.map(group => (
        <section key={group} className={cn('flex min-w-0 flex-col gap-1.5', SPANS[group])}>
          <span className="text-muted text-xs">{t(`documents.templateGroups.${group}`)}</span>
          <ul className={cn('grid gap-2', COLUMNS[group])}>
            {TEMPLATES_BY_GROUP[group].map(id => (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={value === id}
                  data-sc={`field:document.template.${id}`}
                  {...HINT_BOTTOM(t(`documents.templateHints.${id}`))}
                  onClick={() => onChange(id)}
                  className={cn(
                    'w-full cursor-pointer rounded-(--radius-sc-md) border-none p-1',
                    value === id ? 'bg-accent-soft' : 'hover:bg-elevated bg-transparent',
                  )}
                >
                  <MediaTile
                    url={templateThumbnailUrl(id)}
                    caption={t(`documents.templates.${id}`)}
                    fallbackIcon={ICONS[id]}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
