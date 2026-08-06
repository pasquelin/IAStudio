import { net, protocol } from 'electron'
import { isAbsolute, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const ASSET_SCHEME = 'scenario'

const HOST = 'asset'

/** The URL the renderer receives for a local asset. It never learns the file's path. */
export function assetUrl(assetId: string): string {
  return `${ASSET_SCHEME}://${HOST}/${encodeURIComponent(assetId)}`
}

/** `scenario://asset/<id>` → `<id>`. Anything else is not ours to serve. */
export function assetIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${ASSET_SCHEME}:` || parsed.hostname !== HOST) return null

    const id = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
    return id.length > 0 ? id : null
  } catch {
    return null
  }
}

/**
 * Resolves an asset's stored path inside its project, or refuses.
 *
 * The refusal is the point. The path comes from the catalogue, and a catalogue is a file in a
 * folder the user can edit: `../../.ssh/id_rsa` written into a row would otherwise be served
 * to the renderer over a scheme the CSP allows.
 */
export function assetFilePath(projectPath: string, relativePath: string): string | null {
  if (isAbsolute(relativePath)) return null

  const root = resolve(projectPath)
  const file = resolve(root, relativePath)

  return file.startsWith(root + sep) ? file : null
}

/**
 * Declares the scheme before the app is ready. Required for `img-src scenario:` to be honoured
 * and for the renderer to fetch over it at all; Electron ignores the call afterwards.
 */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ])
}

export type AssetResolver = (assetId: string) => string | null

export function serveAssets(resolveAsset: AssetResolver): void {
  protocol.handle(ASSET_SCHEME, request => {
    const assetId = assetIdFromUrl(request.url)
    const file = assetId ? resolveAsset(assetId) : null

    if (!file) return new Response(null, { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}
