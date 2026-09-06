import i18next from 'i18next'
import { assetUrl, versionedUrl, type Asset } from '@shared/domain/asset'
import { getBridge } from './bridge'
import { reportFailure } from './diagnostics'
import { useProject } from '@/stores/project'
import { runTask } from '@/stores/tasks'
import { createWorkerSession } from '@/engines/core/workerSession'
import type {
  AnimationThumbnailRequest,
  AnimationThumbnailResponse,
} from '@/engines/scene/animationThumbnailMessage'

let preceding = Promise.resolve()

export async function generateAnimationThumbnails(assets: readonly Asset[]): Promise<void> {
  const projectPath = useProject.getState().project?.path
  const prior = preceding
  let release: () => void = () => undefined
  preceding = new Promise<void>(resolve => {
    release = resolve
  })
  await prior
  try {
    if (useProject.getState().project?.path === projectPath) await renderBatch(assets)
  } finally {
    release()
  }
}

async function renderBatch(assets: readonly Asset[]): Promise<void> {
  const motions = assets.filter(
    asset => asset.type === 'animation' && asset.path && !asset.posterPath,
  )
  const foundBridge = getBridge()
  const foundProject = useProject.getState().project?.path
  if (!foundBridge || !foundProject || motions.length === 0) return
  const bridge = foundBridge
  const projectPath = foundProject
  await runTask(i18next.t('activity.drawingMotionPosters'), async (_id, watch) => {
    const worker = createWorkerSession<AnimationThumbnailRequest, AnimationThumbnailResponse>(
      () =>
        new Worker(new URL('../engines/scene/animationThumbnail.worker.ts', import.meta.url), {
          type: 'module',
        }),
    )
    const stop = (): void => worker.dispose()
    watch.signal?.addEventListener('abort', stop, { once: true })
    try {
      const model = await bridge.assets.animationThumbnailModel()
      let first = true
      async function renderOne(asset: Asset): Promise<void> {
        if (!asset.path) return
        const bytes = first ? new Uint8Array(model).buffer : undefined
        const result = await worker.send(
          {
            id: worker.nextId(),
            decoderRoot: new URL('./decoders/', document.baseURI).href,
            animationUrl: versionedUrl(assetUrl(asset.id), asset.localChangedAt),
            name: asset.name.replace(/\.[^.]+$/, ''),
            ...(bytes ? { model: bytes } : {}),
          },
          bytes ? [bytes] : [],
        )
        first = false
        if (!result.ok) throw new Error(result.error)
        if (watch.signal?.aborted || useProject.getState().project?.path !== projectPath) return
        await bridge.assets.saveAnimationThumbnail({
          assetId: asset.id,
          sourcePath: asset.path,
          projectPath,
          png: result.png,
        })
      }
      for (const [index, asset] of motions.entries()) {
        if (watch.signal?.aborted || useProject.getState().project?.path !== projectPath) return
        if (!asset.path) continue
        try {
          await renderOne(asset)
        } catch (error) {
          if (watch.signal?.aborted) return
          reportFailure('assets.save', asset.id, error)
          first = true
        }
        watch.onStep?.(index + 1, motions.length)
      }
    } catch (error) {
      if (!watch.signal?.aborted) reportFailure('assets.save', 'animation-thumbnails', error)
    } finally {
      watch.signal?.removeEventListener('abort', stop)
      worker.dispose()
    }
  })
}
