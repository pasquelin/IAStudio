import { exportedBytes } from './exportedResponse'
import { uploadMimeTypeOf } from '@shared/domain/assetMime'

export type ExpandedAssets = {
  files: Readonly<Record<string, string>>
  dispose: () => void
}

export async function expandCompressedAssets(
  files: Readonly<Record<string, string>>,
  compressed: readonly string[],
): Promise<ExpandedAssets> {
  const expanded = { ...files }
  const urls: string[] = []
  try {
    for (const id of compressed) {
      const file = files[id]
      if (!file) continue
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(await exportedBytes(file, 'gzip'))], {
          type: uploadMimeTypeOf(file.endsWith('.gz') ? file.slice(0, -3) : file) ?? '',
        }),
      )
      expanded[id] = url
      urls.push(url)
    }
    return { files: expanded, dispose: () => urls.forEach(url => URL.revokeObjectURL(url)) }
  } catch (error) {
    urls.forEach(url => URL.revokeObjectURL(url))
    throw error
  }
}
