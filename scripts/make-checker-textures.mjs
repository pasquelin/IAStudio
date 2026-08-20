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
import { Buffer } from 'node:buffer'
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 1024

/**
 * Clair plutôt que sombre : la texture est MULTIPLIÉE par la couleur du matériau, donc c'est
 * elle qui doit laisser passer la teinte. Le joint est sombre et marqué, la subdivision à peine
 * plus foncée que la face — c'est ce qui donne de grandes cases lisibles plutôt qu'un moiré.
 */
const FACE = 0xc8
const FACE_ALT = 0xa4
const SUB = 0xb4
const JOINT = 0x4e

/** Une tuile vaut UN MÈTRE : à une répétition par mètre, une case en fait un. */
const JOINT_WIDTH = 9
const SUB_WIDTH = 3

/** Combien de cases par tuile, en combien de sous-carreaux, et si les cases alternent. */
const VARIANTS = [
  { name: 'GridLarge', cells: 1, divisions: 4, alternating: false },
  { name: 'GridSmall', cells: 2, divisions: 2, alternating: false },
  { name: 'CheckerLarge', cells: 2, divisions: 2, alternating: true },
  { name: 'CheckerSmall', cells: 4, divisions: 1, alternating: true },
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

/** Le pixel de la variante en (x, y). Le joint gagne sur la subdivision, qui gagne sur la face. */
function shadeAt(variant, x, y) {
  const cell = SIZE / variant.cells
  // Centré SUR la limite plutôt que posé après elle : deux tuiles voisines partagent alors un
  // seul joint de la bonne épaisseur, au lieu d'en accoler deux moitiés.
  const onJoint = axis => (axis + JOINT_WIDTH / 2) % cell < JOINT_WIDTH
  if (onJoint(x) || onJoint(y)) return JOINT

  const sub = cell / variant.divisions
  const onSub = axis => (axis + SUB_WIDTH / 2) % sub < SUB_WIDTH
  if (variant.divisions > 1 && (onSub(x) || onSub(y))) return SUB

  const checker = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0
  return variant.alternating && checker ? FACE_ALT : FACE
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
