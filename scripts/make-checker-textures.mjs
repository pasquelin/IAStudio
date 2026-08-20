#!/usr/bin/env node
/**
 * Écrit les quatre textures de travail livrées avec l'app, dans `resources/textures/`.
 *
 * Redessinées plutôt qu'extraites d'une capture : une image de référence tient 256 px par
 * variante, ce qui bave dès qu'on approche la surface. Ici c'est du 1024², net au pixel,
 * et le motif se régénère à l'identique — le fichier produit est déterministe.
 *
 * PNG en niveaux de gris 8 bits, écrit à la main : la couleur ne sert à rien pour juger une
 * échelle, et le dépôt n'a aucun encodeur d'image côté Node.
 *
 * Usage : node scripts/make-checker-textures.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 1024

/** Les deux gris du damier, et l'encre des lignes. Ceux de la référence, mesurés dessus. */
const DARK = 0x4a
const LIGHT = 0x5e
const INK = 0xe8

/** Une variante : combien de cases par côté, si les cases alternent, épaisseur du trait. */
const VARIANTS = [
  { name: 'GridLarge', cells: 8, alternating: false, line: 3 },
  { name: 'GridSmall', cells: 16, alternating: false, line: 2 },
  { name: 'CheckerLarge', cells: 8, alternating: true, line: 3 },
  { name: 'CheckerSmall', cells: 16, alternating: true, line: 2 },
]

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

/** Le pixel de la variante en (x, y) : le trait gagne sur la case. */
function shadeAt(variant, x, y) {
  const cell = SIZE / variant.cells
  const inLine = x % cell < variant.line || y % cell < variant.line
  if (inLine) return INK

  const checker = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0
  return variant.alternating && checker ? LIGHT : DARK
}

function pngOf(variant) {
  // Une ligne = son octet de filtre (0, aucun) suivi des pixels. Le motif est régulier, donc
  // deflate le réduit à quelques kilo-octets sans qu'un filtre plus savant n'y change rien.
  const raw = Buffer.alloc((SIZE + 1) * SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    const row = y * (SIZE + 1)
    for (let x = 0; x < SIZE; x += 1) raw[row + 1 + x] = shadeAt(variant, x, y)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header[8] = 8 // huit bits par échantillon
  header[9] = 0 // niveaux de gris, sans canal alpha
  // Les trois derniers octets — compression, filtre, entrelacement — valent zéro, et zéro est
  // la seule valeur que le format autorise pour les deux premiers. `alloc` les a déjà mis là.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const folder = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'textures')
mkdirSync(folder, { recursive: true })

for (const variant of VARIANTS) {
  const file = join(folder, `${variant.name}.png`)
  writeFileSync(file, pngOf(variant))
  console.log(`${variant.name}.png écrit`)
}
