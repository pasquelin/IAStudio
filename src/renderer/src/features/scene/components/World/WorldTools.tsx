import { mdiBrush, mdiBlur, mdiArrowCollapseDown } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PropertySection } from '@/components/PropertySection'
import { SliderField } from '@/components/SliderField'
import { ToolButton } from '@/components/ToolButton'
import { setTerrainEditAlpha } from '@/engines/scene/reliefCommands'
import { TIP_TOP } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'

const FALLOFF = { min: 0, max: 1, step: 0.05, value: 0 }
const RADIUS = { min: 0.1, max: 50, step: 0.1, value: 2 }

/**
 * Contextual sculpt tools for the armed terrain or edit. Smooth and Flatten are structure
 * only — their operations do not exist on the domain yet.
 */
export function WorldTools({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const armed = useSceneViews(state => sceneViewOf(state, documentId).armedRelief)
  const sculptMode = useSceneViews(state => sceneViewOf(state, documentId).sculptMode)
  const [falloff, setFalloff] = useState(FALLOFF.value)
  const [radius, setRadius] = useState(RADIUS.value)

  const layers = useScenes(state => sceneOf(state, documentId).world.layers)
  const terrain = layers.find(layer => layer.kind === 'relief' && layer.id === armed?.terrainId)
  const edit =
    terrain?.kind === 'relief' ? terrain.edits.find(one => one.id === armed?.editId) : undefined

  if (!armed || !terrain) return null

  return (
    <PropertySection title={t('world.tools')} scId="world.tools" defaultOpen>
      <div className="flex">
        <ToolButton
          icon={mdiBrush}
          label={t('world.sculpt')}
          description={t('world.sculptHint')}
          tooltip={TIP_TOP}
          variant="bar"
          active={sculptMode}
          onClick={() => useSceneViews.getState().setSculptMode(documentId, !sculptMode)}
        />
        <ToolButton
          icon={mdiBlur}
          label={t('world.smooth')}
          description={t('world.smoothHint')}
          tooltip={TIP_TOP}
          variant="bar"
          disabled
        />
        <ToolButton
          icon={mdiArrowCollapseDown}
          label={t('world.flatten')}
          description={t('world.flattenHint')}
          tooltip={TIP_TOP}
          variant="bar"
          disabled
        />
      </div>
      <SliderField
        label={t('world.falloff')}
        scId="world.falloff"
        value={falloff}
        min={FALLOFF.min}
        max={FALLOFF.max}
        step={FALLOFF.step}
        onChange={setFalloff}
        onReset={() => setFalloff(FALLOFF.value)}
      />
      <SliderField
        label={t('world.radius')}
        scId="world.radius"
        value={radius}
        min={RADIUS.min}
        max={RADIUS.max}
        step={RADIUS.step}
        onChange={setRadius}
        onReset={() => setRadius(RADIUS.value)}
      />
      {edit ? (
        <SliderField
          label={t('world.alpha')}
          scId="world.alpha"
          value={edit.alpha}
          min={-1}
          max={1}
          step={0.05}
          onChange={alpha =>
            useScenes
              .getState()
              .runCommand(documentId, setTerrainEditAlpha(terrain.id, edit.id, alpha))
          }
          onReset={() =>
            useScenes.getState().runCommand(documentId, setTerrainEditAlpha(terrain.id, edit.id, 1))
          }
        />
      ) : null}
    </PropertySection>
  )
}
