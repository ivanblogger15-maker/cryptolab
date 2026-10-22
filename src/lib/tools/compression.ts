import { safeBaseName } from '../bytes'
import { fail } from '../errors'
import type { Tool } from '../types'

type Format = 'gzip' | 'deflate' | 'br'

interface FormatDef {
  id: string
  name: string
  format: Format
  extension: string
  mime: string
}

const formats: FormatDef[] = [
  { id: 'gzip', name: 'GZIP', format: 'gzip', extension: '.gz', mime: 'application/gzip' },
  { id: 'deflate', name: 'DEFLATE (zlib)', format: 'deflate', extension: '.zlib', mime: 'application/zlib' },
  { id: 'brotli', name: 'Brotli', format: 'br', extension: '.br', mime: 'application/octet-stream' },
]

/**
 * Brotli is not part of the Compression Streams standard, so it is handled by a
 * WASM build that is loaded on demand (it never leaves the browser).
 */
async function brotli(data: Uint8Array, mode: 'compress' | 'decompress'): Promise<Uint8Array> {
  try {
    const mod = await import('brotli-wasm')
    const loaded: unknown = await mod.default
    // The browser bundle resolves to a promise of the WASM API; the Node bundle
    // exposes the API directly with a `default` promise for compatibility.
    const api = (
      typeof (loaded as { compress?: unknown })?.compress === 'function'
        ? loaded
        : await (loaded as { default?: unknown })?.default
    ) as { compress: (b: Uint8Array, o?: { quality?: number }) => Uint8Array; decompress: (b: Uint8Array) => Uint8Array }
    if (typeof api?.compress !== 'function') fail('unsupported')
    return mode === 'compress' ? api.compress(data, { quality: 11 }) : api.decompress(data)
  } catch {
    fail(mode === 'compress' ? 'unsupported' : 'invalid_params')
  }
}

async function pipe(
  data: Uint8Array,
  format: Format,
  mode: 'compress' | 'decompress',
): Promise<Uint8Array> {
  if (format === 'br') return brotli(data, mode)
  try {
    const ctor = mode === 'compress' ? CompressionStream : DecompressionStream
    const stream = new ctor(format)
    const writer = stream.writable.getWriter()
    const resultPromise = new Response(stream.readable).arrayBuffer()
    await writer.write(data as unknown as BufferSource)
    await writer.close()
    return new Uint8Array(await resultPromise)
  } catch {
    fail(mode === 'compress' ? 'unsupported' : 'invalid_params')
  }
}

export const compressionTools: Tool[] = formats.map((fmt) => ({
  id: fmt.id,
  name: fmt.name,
  category: 'compression',
  action: 'compress',
  reversible: true,
  run: async ({ direction, input, fileName }) => {
    const compress = direction === 'encode'
    const output = await pipe(input, fmt.format, compress ? 'compress' : 'decompress')
    let name: string | undefined
    if (fileName) {
      name = compress
        ? `${safeBaseName(fileName)}${fmt.extension}`
        : fileName.endsWith(fmt.extension)
          ? fileName.slice(0, -fmt.extension.length)
          : undefined
    }
    return {
      bytes: output,
      filename: name,
      mime: compress ? fmt.mime : undefined,
      metas: [
        { label: 'meta.algorithm', value: fmt.name },
        { label: 'meta.inputSize', value: `${input.length} bytes` },
        { label: 'meta.outputSize', value: `${output.length} bytes` },
      ],
      noteKeys: ['note.compression'],
    }
  },
}))
