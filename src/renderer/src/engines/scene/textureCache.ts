import {
  DataTexture,
  TextureLoader,
  UnsignedByteType,
  type ColorSpace,
  type Loader,
  type Texture,
} from 'three'
import { assetUrl, versionedUrl } from '@shared/domain/asset'
import { decoderFor, type PictureDecoder } from '@shared/domain/pictureDecoder'
import { createRefCache } from '../core/refCache'

/** A port rather than a hard-wired `TextureLoader`, like `SqliteDriver`: jsdom decodes no image. */
export type TextureSource = (url: string) => Promise<Texture>

/** What `decoderFor` reads: an OpenEXR magic, a TIFF one, or the `#?RADIANCE` line. */
const SIGNATURE_BYTES = 16

/**
 * What production hands every engine that decodes a picture. Here rather than at each of them:
 * the port is declared on this line, and three spaces had grown their own identical copy of the
 * one implementation it has.
 *
 * Read once and routed by the BYTES: no browser decodes Radiance or OpenEXR, and an `<img>` handed
 * either lands as a picture of nothing — which is what a sky lit by an `.exr` used to be.
 */
export const loadTexture: TextureSource = async url => {
  const answer = await fetch(url)
  if (!answer.ok) throw new Error(`${url} answered ${answer.status}`)

  // The BLOB rather than the bytes, and the HEAD of it rather than the whole. Two things ride on
  // that: the served type stays on it — a blob with none renders no SVG at all, `<img>` reading
  // the vector case by the MIME — and an ordinary 4K picture, which is nearly all of them, no
  // longer has a 32 MiB copy of itself made in JavaScript to read sixteen bytes.
  const blob = await answer.blob()
  const decoder = decoderFor(new Uint8Array(await blob.slice(0, SIGNATURE_BYTES).arrayBuffer()))

  // A container rather than a picture: `utif` hands back plain RGBA, which no `<img>` is needed
  // for and no three loader reads. The one path that does need every byte asks for them here.
  if (decoder === 'tiff') return tiffTexture(new Uint8Array(await blob.arrayBuffer()))

  const object = URL.createObjectURL(blob)

  try {
    return await (await loaderFor(decoder)).loadAsync(object)
  } finally {
    URL.revokeObjectURL(object)
  }
}

/**
 * `loadAsync` rather than `parse` for the two of them: `parse` answers raw texture DATA, and it is
 * `load` that turns it into the `DataTexture` — flags, wrapping and all — that a material can wear.
 * Each parser is imported only when a file actually is one; together they are some 90 Ko.
 */
async function loaderFor(decoder: PictureDecoder | null): Promise<Loader<Texture>> {
  // `HDRLoader`, not the `RGBELoader` every example written before r180 names: that one is a
  // deprecated alias, and constructing it warns on the console at every picture.
  if (decoder === 'radiance') {
    return new (await import('three/addons/loaders/HDRLoader.js')).HDRLoader()
  }
  if (decoder === 'openexr') {
    return new (await import('three/addons/loaders/EXRLoader.js')).EXRLoader()
  }
  return new TextureLoader()
}

/**
 * The FIRST image of the container, which is the picture — the ones after it are a scan's further
 * pages or a texture's mip levels, and showing page two for page one would be the wrong answer.
 */
async function tiffTexture(bytes: Uint8Array): Promise<Texture> {
  const { decode, decodeImage, toRGBA8 } = await import('utif')

  const pages = decode(bytes)
  const [first] = pages
  if (!first) throw new Error('this TIFF holds no image at all')

  decodeImage(bytes, first, pages)
  const texture = new DataTexture(toRGBA8(first), first.width, first.height)
  // A picture, not a table of numbers: `DataTexture` defaults to `RGBAFormat` and `UnsignedByte`,
  // which is what `toRGBA8` answers — only the flip and the update are left to say.
  texture.flipY = true
  texture.needsUpdate = true
  return texture
}

export type TextureCache = {
  /**
   * Takes a reference on an asset read in a given colour space, loading it if nobody holds it
   * yet. Resolves to `null` when the last holder let go before it arrived: a texture nobody
   * wants any more must not come back to life, and the loaded image is freed on the spot.
   */
  acquire: (assetId: string, colorSpace: ColorSpace, version?: string) => Promise<Texture | null>
  /** Gives a reference back. The texture is freed once the last one goes. */
  release: (assetId: string, colorSpace: ColorSpace, version?: string) => void
  /**
   * When the file behind this asset was last written, as far as the catalogue knows.
   *
   * Asked HERE rather than passed in by every slot: what holds a reference is a slot pointing at
   * an id, and the id does not move when ⌘S overwrites the picture — see `TextureBinding`, which
   * is what compares one call to the next.
   */
  versionOf: (assetId: string) => string | undefined
  /** Frees everything, whoever still holds it — the engine is going away. */
  dispose: () => void
}

const SEPARATOR = ':'

/**
 * One texture per asset AND colour space, however many materials point at it. The colour space
 * belongs to the key rather than to the holder: the same picture can dress one mesh as a base
 * map, read as sRGB, and another as roughness, read as data — and they are two different
 * textures on the GPU. Setting it on a shared instance would silently wash out the second.
 */
export function createTextureCache(
  load: TextureSource,
  onFailure: (assetId: string, error: unknown) => void,
  /**
   * When each asset was last written. Absent leaves every URL bare, which is what a workspace
   * with no catalogue behind it — and every test — wants.
   */
  versionOf: (assetId: string) => string | undefined = () => undefined,
): TextureCache {
  const cache = createRefCache<Texture>({
    load: async key => {
      const { colorSpace, assetId, version } = splitKey(key)
      // Stamped, or a picture the studio has just overwritten would come back from the browser's
      // own cache under an id that never moved — the ⌘S would look like it did nothing.
      const texture = await load(versionedUrl(assetUrl(assetId), version))
      // NOT over a float decode: a `.hdr` or an `.exr` comes back linear already, and stamping
      // sRGB over it has the shader decode a second time — a sky visibly darker than its file.
      if (texture.type === UnsignedByteType) texture.colorSpace = colorSpace
      return texture
    },
    free: texture => texture.dispose(),
    // The asset, not the key: which colour space it was read in says nothing to a reader.
    onFailure: (key, error) => onFailure(splitKey(key).assetId, error),
  })

  // The version is escaped, and that is not decoration: it is an ISO stamp, so it holds the very
  // separator this key is cut on — unescaped, the cut landed inside `10:00:00` and the loader was
  // handed an asset id made of half a date.
  const keyOf = (assetId: string, colorSpace: ColorSpace, version = ''): string =>
    `${colorSpace}${SEPARATOR}${encodeURIComponent(version)}${SEPARATOR}${assetId}`

  return {
    acquire: (assetId, colorSpace, version) => cache.acquire(keyOf(assetId, colorSpace, version)),
    release: (assetId, colorSpace, version) => cache.release(keyOf(assetId, colorSpace, version)),
    versionOf,
    dispose: cache.dispose,
  }
}

/**
 * An asset id may hold a separator; the two fields in front of it cannot — a colour space is a
 * word, and the version was escaped by `keyOf` — so the first two cuts settle it and the rest is
 * the id, however it is spelled.
 */
function splitKey(key: string): { colorSpace: ColorSpace; version: string; assetId: string } {
  const space = key.indexOf(SEPARATOR)
  const stamp = key.indexOf(SEPARATOR, space + 1)
  return {
    // `as`: the key was built by `keyOf` from a `ColorSpace`, and nothing else reaches this.
    colorSpace: key.slice(0, space) as ColorSpace,
    version: decodeURIComponent(key.slice(space + 1, stamp)),
    assetId: key.slice(stamp + 1),
  }
}
