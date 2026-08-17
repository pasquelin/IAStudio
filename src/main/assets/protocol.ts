import { net, protocol } from 'electron'
import { isAbsolute, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ASSET_SCHEME, hostedParts, type Asset } from '@shared/domain/asset'

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
 * Which file the scheme hands over: what the project owns, else the proxy of a linked media,
 * else the linked media itself. The proxy comes first because it exists precisely for sources
 * WebCodecs will not decode; a linked path must be absolute, which is what a picker returns.
 */
export function servedFileOf(projectPath: string, asset: Asset): string | null {
  if (asset.path) return assetFilePath(projectPath, asset.path)
  if (asset.proxyPath) return assetFilePath(projectPath, asset.proxyPath)
  return linkedFileOf(asset)
}

/**
 * The still that stands for an asset, when one was written beside it — what the `poster` host
 * serves. Never falls back to the asset's own file: a `.glb` handed to an `<img>` is the broken
 * tile this exists to replace, and answering nothing lets the browser draw its icon instead.
 */
export function posterFileOf(projectPath: string, asset: Asset): string | null {
  return asset.posterPath ? assetFilePath(projectPath, asset.posterPath) : null
}

/**
 * The file the user would call theirs: what the project holds, else the media they linked —
 * never the proxy, which is ours and which they never put there. This is what "show it in the
 * Finder" means; the scheme wants the opposite order, and that is `servedFileOf`.
 */
export function ownFileOf(projectPath: string, asset: Asset): string | null {
  if (asset.path) return assetFilePath(projectPath, asset.path)
  return linkedFileOf(asset)
}

/** A linked media sits outside the project, so only an absolute path can name it. */
function linkedFileOf(asset: Asset): string | null {
  if (!asset.sourcePath) return null
  return isAbsolute(asset.sourcePath) ? asset.sourcePath : null
}

/**
 * Declares the scheme before the app is ready. Required for `img-src scenario:` to be honoured
 * and for the renderer to fetch over it at all; Electron ignores the call afterwards.
 */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        // The window loads on another origin, so reading an asset is a cross-origin request.
        // Without this `<img>` still paints and only the decoder fails — which reads as a
        // broken monitor rather than as a refusal.
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

/** Asynchronous since the catalogue moved to its own thread — see `catalog-thread.ts`. */
type AssetResolver = (key: string) => Promise<string | null>

/**
 * One resolver per host of the scheme, each reading the key ITS host is named by: an asset id for
 * `asset` and `poster`, a favourite id for `favorite` — kept outside every project, which is why
 * no catalogue can answer for it — and a project-relative PATH for `thumb`, whose subject is a
 * file the catalogue has most often never heard of. A further kind is a further entry.
 */
export type AssetResolvers = Readonly<Record<string, AssetResolver>>

export function serveAssets(resolvers: AssetResolvers): void {
  protocol.handle(ASSET_SCHEME, async request => {
    const file = await servedPath(request.url, resolvers)

    if (!file) return new Response(null, { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}

/**
 * Which file a URL of the scheme names — the routing itself, apart from the handler so it can be
 * tested without an Electron `protocol`. A host nobody registered is answered with nothing.
 */
export async function servedPath(url: string, resolvers: AssetResolvers): Promise<string | null> {
  const parsed = hostedParts(url)
  if (!parsed) return null

  // `hasOwn`, not a plain lookup: every key of `Object.prototype` would otherwise be a live host,
  // and `scenario://toString/x` would reach `net.fetch` with a path nobody registered.
  if (!Object.hasOwn(resolvers, parsed.host)) return null

  const resolveHost = resolvers[parsed.host]
  return resolveHost ? resolveHost(parsed.id) : null
}
