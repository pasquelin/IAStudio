/**
 * The surface of `utif` the studio uses. The package ships no types of its own and none exist on
 * DefinitelyTyped, so what is called is declared here and nothing more: a declaration nobody can
 * drift from is worth more than a complete one.
 *
 * Under `shared/` for the reason `opentype.d.ts` is — both TypeScript projects have to see it, and
 * this is the one folder they both include. A declaration only: `shared/` imports nothing at run
 * time, and the picture side is what calls this library.
 */
declare module 'utif' {
  /**
   * One image of the file. A TIFF is a CONTAINER: a scan holds pages, a texture holds mip levels,
   * and `decode` answers all of them in order.
   */
  export type IFD = {
    width: number
    height: number
    /** Filled by `decodeImage`, which is a separate call — `decode` reads the directories alone. */
    data?: Uint8Array
    [tag: string]: unknown
  }

  /** The image directories, without their pixels. */
  export function decode(buffer: ArrayBuffer | Uint8Array): IFD[]

  /** Reads one directory's pixels into `ifd.data`, whatever the compression it declares. */
  export function decodeImage(
    buffer: ArrayBuffer | Uint8Array,
    ifd: IFD,
    /** The whole listing, which a page needs to resolve the tables another page holds. */
    ifds?: IFD[],
  ): void

  /** RGBA, eight bits a channel, whatever the file's own depth and layout. */
  export function toRGBA8(ifd: IFD): Uint8Array
}
