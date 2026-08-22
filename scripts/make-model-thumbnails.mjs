#!/usr/bin/env node
/**
 * Écrit une vignette par entrée du catalogue local, dans `resources/models/`.
 *
 * EMBARQUÉES plutôt que téléchargées : elles ont le même cycle de vie que le catalogue, donc
 * aucun lien ne peut mourir, un panneau se dessine hors ligne, et aucune requête ne part vers un
 * tiers pour peindre une carte. Environ un kilo-octet pièce.
 *
 * Le motif est DÉRIVÉ de l'identifiant : une grille 8×8 symétrique, deux teintes tirées du même
 * hachage. Deux modèles ne se ressemblent donc jamais, et le fichier produit est déterministe —
 * relancer le script ne change pas un octet.
 *
 * PNG RGB 8 bits, écrit par `scripts/png.mjs` — l'encodeur que ce script partage avec celui des
 * textures de travail : un motif à blocs se comprime en quelques centaines d'octets.
 *
 * Usage : node scripts/make-model-thumbnails.mjs
 */
import { Buffer } from 'node:buffer'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pngOf, RGB } from './png.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SIZE = 256
const CELLS = 8
const CELL = SIZE / CELLS

/**
 * Les vignettes génériques, par modalité — ce que reçoit un modèle ajouté à la main, dont rien
 * ne dit à quoi il ressemble. Leur graine est le mot lui-même, donc elles ne bougent jamais.
 */
const GENERIC = ['text', 'image']

/**
 * Le modèle de reconnaissance, qui vit dans `dictation.ts` et non dans le JSON du catalogue :
 * c'est ce fichier-là qui le possède, et le lire à la regex casserait au premier renommage.
 */
const STT_MODEL_ID = 'parakeet-tdt-0.6b-v3-int8'

/** FNV-1a 32 bits : court, sans dépendance, et stable d'une version de Node à l'autre. */
function hashOf(text) {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193) >>> 0
  }
  return value
}

/** HSL vers RGB, saturation et luminosité fixes : ce qui varie d'un modèle à l'autre est la teinte. */
function rgbOf(hue, lightness) {
  const chroma = 0.42 * (1 - Math.abs(2 * lightness - 1))
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const base = lightness - chroma / 2

  const wheel = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ]
  const [red, green, blue] = wheel[Math.floor(hue / 60) % 6]

  return [red, green, blue].map(part => Math.round((part + base) * 255))
}

/**
 * La grille du motif : huit colonnes, symétriques autour de l'axe vertical.
 *
 * Symétrique parce qu'un bruit sans axe se lit comme une erreur d'affichage, là où une figure
 * miroir se lit comme un emblème — c'est ce qui distingue une identicon d'un damier au hasard.
 */
function patternOf(seed) {
  const half = Math.ceil(CELLS / 2)
  const grid = []

  for (let row = 0; row < CELLS; row += 1) {
    const line = []
    for (let column = 0; column < half; column += 1) {
      line.push((hashOf(`${seed}:${row}:${column}`) & 0xff) > 0x88)
    }
    grid.push([...line, ...line.slice(0, CELLS - half).reverse()])
  }

  return grid
}

function thumbnailOf(seed) {
  const hash = hashOf(seed)
  const hue = hash % 360
  const ink = rgbOf(hue, 0.62)
  // La seconde teinte est à l'opposé du cercle, assombrie : le fond reste sombre comme les
  // surfaces du studio, et la figure est ce qui ressort.
  const ground = rgbOf((hue + 180) % 360, 0.16)
  const grid = patternOf(seed)

  const raw = Buffer.alloc((SIZE * 3 + 1) * SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    const row = y * (SIZE * 3 + 1)
    for (let x = 0; x < SIZE; x += 1) {
      const colour = grid[Math.floor(y / CELL)][Math.floor(x / CELL)] ? ink : ground
      raw[row + 1 + x * 3] = colour[0]
      raw[row + 2 + x * 3] = colour[1]
      raw[row + 3 + x * 3] = colour[2]
    }
  }

  return pngOf(SIZE, SIZE, RGB, raw)
}

/** Les identifiants du catalogue livré, lus depuis la donnée plutôt que recopiés ici. */
function catalogueIds() {
  const file = join(HERE, '..', 'src', 'shared', 'domain', 'localModels.json')
  return Object.values(JSON.parse(readFileSync(file, 'utf8')))
    .flat()
    .map(model => model.id)
}

const folder = join(HERE, '..', 'resources', 'models')
mkdirSync(folder, { recursive: true })

for (const seed of [...catalogueIds(), STT_MODEL_ID, ...GENERIC]) {
  const bytes = thumbnailOf(seed)
  writeFileSync(join(folder, `${seed}.png`), bytes)
  console.log(`${seed}.png écrit — ${bytes.length} octets`)
}
