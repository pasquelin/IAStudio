import { useTranslation } from 'react-i18next'
import type { SceneStats } from '@/engines/scene/scene-stats'

export type SceneCountersProps = {
  scene: SceneStats
  /** What the selection alone costs. Drawn beside the whole only when something is selected. */
  selected: SceneStats
}

/** A megabyte, the unit a texture budget is discussed in. */
const MEGABYTE = 1024 * 1024

/**
 * What the scene costs, in the corner of the viewport.
 *
 * Over the picture rather than in a panel, which is where every 3D tool puts it: the number is
 * read WHILE a model is turned around, and a panel one has to switch to is a number nobody
 * consults. It is deliberately quiet — dim, small, and never in the way of the trihedron, which
 * sits in the opposite corner.
 */
export function SceneCounters({ scene, selected }: SceneCountersProps) {
  const { t, i18n } = useTranslation()
  const count = (value: number): string => value.toLocaleString(i18n.language)

  const rows: readonly { key: string; label: string; whole: string; part: string }[] = [
    {
      key: 'triangles',
      label: t('sceneCounters.triangles'),
      whole: count(scene.triangles),
      part: count(selected.triangles),
    },
    {
      key: 'vertices',
      label: t('sceneCounters.vertices'),
      whole: count(scene.vertices),
      part: count(selected.vertices),
    },
    {
      key: 'draws',
      label: t('sceneCounters.draws'),
      whole: count(scene.draws),
      part: count(selected.draws),
    },
    {
      key: 'textures',
      label: t('sceneCounters.textures'),
      whole: t('sceneCounters.megabytes', { value: scene.textureBytes / MEGABYTE }),
      part: t('sceneCounters.megabytes', { value: selected.textureBytes / MEGABYTE }),
    },
  ]

  const showsSelection = selected.draws > 0

  return (
    <div
      // Pointer events off: it sits over the canvas, and a click meant for the model must not
      // land on a read-out.
      className="text-muted bg-panel/80 pointer-events-none absolute bottom-2 left-2 rounded-(--radius-sc-md) px-2 py-1 text-[10px] tabular-nums"
    >
      <table>
        <caption className="sr-only">{t('sceneCounters.title')}</caption>
        <tbody>
          {rows.map(row => (
            <tr key={row.key}>
              <th scope="row" className="pr-2 text-left font-normal">
                {row.label}
              </th>
              <td className="text-text pr-2 text-right">{row.whole}</td>
              {showsSelection && <td className="text-right">{row.part}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
