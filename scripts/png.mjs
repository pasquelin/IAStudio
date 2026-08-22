/**
 * L'encodeur PNG du dépôt, écrit à la main : Node n'en a pas, et les deux scripts qui dessinent
 * des ressources — les textures de travail et les vignettes de modèles — en avaient chacun une
 * copie au caractère près.
 *
 * Rien de plus que ce que ces deux-là demandent : huit bits par échantillon, pas d'entrelacement,
 * une seule passe de deflate.
 */
import { Buffer } from 'node:buffer'
import { deflateSync } from 'node:zlib'

/** Niveaux de gris sans alpha, et RVB sans alpha — les deux seuls types utilisés ici. */
export const GREYSCALE = 0
export const RGB = 2

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function chunk(type, body) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(body.length, 0)
  head.write(type, 4, 'ascii')

  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0)
  return Buffer.concat([head, body, crc])
}

/**
 * `raw` porte les lignes filtrées : un octet de filtre — zéro, aucun — puis les pixels. Les motifs
 * de ces scripts sont réguliers, donc deflate les réduit à quelques centaines d'octets sans qu'un
 * filtre plus savant n'y change rien.
 */
export function pngOf(width, height, colourType, raw) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // huit bits par échantillon
  header[9] = colourType
  // Les trois derniers octets — compression, filtre, entrelacement — valent zéro, et zéro est la
  // seule valeur que le format autorise pour les deux premiers. `alloc` les a déjà mis là.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
