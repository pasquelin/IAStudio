import type { AssetType } from './asset'

/**
 * How many leading bytes the caller must read for the table below to be able to answer. The
 * furthest magic is a container brand at offset 8, and 32 leaves room for one more.
 */
export const SIGNATURE_BYTES = 32

/** The four a file can BE by its bytes — a texture and a sky are never guessed, see `natureOf`. */
type SourceDomain = Extract<AssetType, 'image' | 'video' | 'audio' | 'mesh'>

type Signature = {
  at: number
  magic: readonly number[]
  domain: SourceDomain
}

const ascii = (text: string): number[] => [...text].map(character => character.charCodeAt(0))

/**
 * What the first bytes of a file say it is — read in order, so a container's brand is matched
 * before the generic `ftyp` that every one of them carries.
 */
const SIGNATURES: readonly Signature[] = [
  { at: 0, magic: [0x89, 0x50, 0x4e, 0x47], domain: 'image' },
  { at: 0, magic: [0xff, 0xd8, 0xff], domain: 'image' },
  { at: 0, magic: ascii('GIF8'), domain: 'image' },
  { at: 0, magic: ascii('<svg'), domain: 'image' },
  { at: 0, magic: ascii('<?xml'), domain: 'image' },
  { at: 0, magic: ascii('glTF'), domain: 'mesh' },
  { at: 0, magic: ascii('fLaC'), domain: 'audio' },
  { at: 0, magic: ascii('OggS'), domain: 'audio' },
  { at: 0, magic: ascii('ID3'), domain: 'audio' },
  { at: 0, magic: [0xff, 0xfb], domain: 'audio' },
  { at: 0, magic: [0xff, 0xf3], domain: 'audio' },
  { at: 0, magic: [0xff, 0xf2], domain: 'audio' },
  { at: 0, magic: [0x1a, 0x45, 0xdf, 0xa3], domain: 'video' },
  { at: 8, magic: ascii('WEBP'), domain: 'image' },
  { at: 8, magic: ascii('WAVE'), domain: 'audio' },
  { at: 8, magic: ascii('avif'), domain: 'image' },
  { at: 8, magic: ascii('avis'), domain: 'image' },
  { at: 8, magic: ascii('M4A '), domain: 'audio' },
  // Every other ISO container — `isom`, `mp42`, `qt  `, `M4V ` — is something that runs in time.
  { at: 4, magic: ascii('ftyp'), domain: 'video' },
]

function matches(bytes: Uint8Array, { at, magic }: Signature): boolean {
  return magic.every((byte, index) => bytes[at + index] === byte)
}

/**
 * Which domain a file belongs to, read from its bytes alone — `null` when they say nothing we
 * know. Asked ONLY of a file whose name carries no extension: a suffix that is present is what
 * the user wrote, and it wins even when it lies.
 */
export function domainFromSignature(bytes: Uint8Array): SourceDomain | null {
  return SIGNATURES.find(signature => matches(bytes, signature))?.domain ?? null
}
