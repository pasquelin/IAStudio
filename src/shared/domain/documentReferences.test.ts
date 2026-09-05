import { describe, expect, it } from 'vitest'
import { documentReferencesOf, SCANNED_BYTES } from './documentReferences'

const gltf = (body: Record<string, unknown>): string =>
  JSON.stringify({ asset: { version: '2.0' }, ...body })

describe('documentReferencesOf', () => {
  it('names the binary and the pictures a glTF hangs its scene on', () => {
    const text = gltf({
      buffers: [{ uri: 'Niveau.bin' }],
      images: [{ uri: 'textures/peau.png' }, { uri: 'textures/normale.png' }],
    })

    expect(documentReferencesOf('gltf', text)).toEqual([
      'Niveau.bin',
      'textures/peau.png',
      'textures/normale.png',
    ])
  })

  it('names the picture a sky hangs off its node rather than off images', () => {
    const text = gltf({
      nodes: [{ name: 'Horizon', extras: { iastudio: { source: 'Ciel.hdr' } } }],
    })

    expect(documentReferencesOf('gltf', text)).toEqual(['Ciel.hdr'])
  })

  it('follows nothing that names a file outside the folder the document sits in', () => {
    const text = gltf({
      buffers: [
        { uri: 'data:application/octet-stream;base64,AAAA' },
        { uri: 'https://ailleurs.example/Niveau.bin' },
        { uri: '/etc/passwd' },
        { uri: '../voisin/Niveau.bin' },
        { uri: '..\\voisin\\Niveau.bin' },
      ],
    })

    expect(documentReferencesOf('gltf', text)).toEqual([])
  })

  it('reads a reference back through its percent encoding', () => {
    expect(documentReferencesOf('gltf', gltf({ buffers: [{ uri: 'mon%20niveau.bin' }] }))).toEqual([
      'mon niveau.bin',
    ])
  })

  it('names every filename input of a material, whatever graph holds it', () => {
    const text = [
      '<materialx version="1.39">',
      '  <nodegraph name="NG_dautrui">',
      '    <tiledimage name="quelconque" type="color3">',
      '      <input name="file" type="filename" value="bois_albedo.png" />',
      '    </tiledimage>',
      '    <image name="autre" type="vector3">',
      '      <input name="file" type="filename" value="bois_normale.png" />',
      '      <input name="default" type="vector3" value="0, 0, 1" />',
      '    </image>',
      '  </nodegraph>',
      '</materialx>',
    ].join('\n')

    expect(documentReferencesOf('mtlx', text)).toEqual(['bois_albedo.png', 'bois_normale.png'])
  })

  it('names each file once, however many times the document points at it', () => {
    const text = gltf({ buffers: [{ uri: 'Niveau.bin' }], images: [{ uri: 'Niveau.bin' }] })

    expect(documentReferencesOf('gltf', text)).toEqual(['Niveau.bin'])
  })

  it('reads nothing out of a file too big to be one that points at siblings', () => {
    const padding = ' '.repeat(SCANNED_BYTES)

    expect(
      documentReferencesOf('gltf', `${gltf({ buffers: [{ uri: 'a.bin' }] })}${padding}`),
    ).toEqual([])
  })

  it('reads nothing out of a document that does not parse, leaving the refusal to the import', () => {
    expect(documentReferencesOf('gltf', '{ pas du json')).toEqual([])
  })

  it('reads nothing out of an extension that carries its parts inside itself', () => {
    expect(documentReferencesOf('ora', gltf({ buffers: [{ uri: 'a.bin' }] }))).toEqual([])
  })
})
