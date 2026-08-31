/**
 * The window decides what a file is ALLOWED to say — `readPostPresetFile` reads it against the
 * catalogue and names what it dropped; the main process only moves bytes. A preset names ids and
 * numbers, and has no shape in which anything runnable could ride.
 */
import { readPostPresetFile, postPresetFile } from '@shared/domain/postPresets'
import type { PostStack } from '@shared/domain/postProcessing'
import i18next from 'i18next'
import { getBridge } from '@/services/bridge'
import { reportFailure, reportNotice } from '@/services/diagnostics'
import { newId } from '@/helpers/ids'

/** Writes the composition wherever the save dialog lands, and says where it went. */
export async function exportPostPreset(name: string, stack: PostStack): Promise<void> {
  const bridge = getBridge()
  if (!bridge) return

  try {
    const written = await bridge.post.export({
      name,
      content: JSON.stringify(postPresetFile(name, stack), null, 2),
    })
    if (written) reportNotice('scene.post', i18next.t('postfx.exported', { name: written }))
  } catch (error) {
    reportFailure('scene.post', name, error)
  }
}

/** Nothing is applied on a refusal; unknown effects are dropped and named. */
export async function importPostPreset(apply: (stack: PostStack) => void): Promise<void> {
  const bridge = getBridge()
  if (!bridge) return

  let content: string | null
  try {
    content = await bridge.post.import()
  } catch (error) {
    reportFailure('scene.post', 'import', error)
    return
  }
  if (content === null) return

  const read = readPostPresetFile(parsed(content), newId)
  if (!read.ok) {
    reportNotice(
      'scene.post',
      i18next.t(
        read.reason === 'version' ? 'postfx.importFailedVersion' : 'postfx.importFailedShape',
      ),
    )
    return
  }

  apply(read.stack)
  reportNotice('scene.post', i18next.t('postfx.imported', { name: read.name }))
  // Said apart from the success, and never in its place: what was applied IS what the file could
  // give, and a reader has to know which effects it did not.
  if (read.dropped.length > 0) {
    reportNotice(
      'scene.post',
      i18next.t('postfx.importDropped', { names: read.dropped.join(', ') }),
    )
  }
}

/** A file somebody may have edited by hand: unparseable is a refusal, never a throw. */
function parsed(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}
