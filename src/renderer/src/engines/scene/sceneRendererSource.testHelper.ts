import entry from './SceneRenderer.ts?raw'
import support from './sceneRendererSupport2.ts?raw'

const parts = import.meta.glob<string>('./SceneRenderer*.ts', {
  eager: true,
  import: 'default',
  query: '?raw',
})

export const sceneRendererSource = [entry, support, ...Object.values(parts)].join('\n')
