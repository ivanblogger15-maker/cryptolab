import { blake2b } from '@noble/hashes/blake2.js'
import { blake3 } from '@noble/hashes/blake3.js'
import { md5, sha1 } from '@noble/hashes/legacy.js'
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js'
import { sha3_256, sha3_512 } from '@noble/hashes/sha3.js'
import { bytesToBase64, fromHex, randomBytes, toHex, tryUtf8, utf8 } from '../bytes'
import { fail } from '../errors'
import type { Tool, ToolOutput } from '../types'
import { ab } from '../webcrypto'

function digestOutput(digest: Uint8Array): ToolOutput {
  const hex = toHex(digest)
  return {
    bytes: utf8(hex),
    text: hex,
    metas: [
      { label: 'meta.base64', value: bytesToBase64(digest), mono: true },
      { label: 'meta.bits', value: String(digest.length * 8) },
    ],
  }
}

function digestTool(id: string, name: string, fn: (input: Uint8Array) => Uint8Array): Tool {
  return {
    id,
    name,
    category: 'hash',
    action: 'hash',
    run: ({ input }) => digestOutput(fn(input)),
  }
}

function passwordOf(input: Uint8Array): string {
  const text = tryUtf8(input)
  if (text === null) fail('not_text')
  // hash-wasm rejects empty passwords with a generic error; surface a clear one.
  if (text.length === 0) fail('empty_input')
  return text
}

export const hashTools: Tool[] = [
  digestTool('md5', 'MD5', md5),
  digestTool('sha1', 'SHA-1', sha1),
  digestTool('sha256', 'SHA-256', sha256),
  digestTool('sha384', 'SHA-384', sha384),
  digestTool('sha512', 'SHA-512', sha512),
  digestTool('sha3-256', 'SHA3-256', sha3_256),
  digestTool('sha3-512', 'SHA3-512', sha3_512),
  {
    id: 'blake2b',
    name: 'BLAKE2b',
    category: 'hash',
    action: 'hash',
    params: [
      {
        id: 'bits',
        label: 'p.outputBits',
        type: 'select',
        default: '512',
        width: 'half',
        options: [
          { value: '256', label: '256 bits' },
          { value: '512', label: '512 bits' },
        ],
      },
    ],
    run: ({ input, params }) => digestOutput(blake2b(input, { dkLen: Number(params.bits ?? '512') / 8 })),
  },
  {
    id: 'blake3',
    name: 'BLAKE3',
    category: 'hash',
    action: 'hash',
    params: [
      {
        id: 'bits',
        label: 'p.outputBits',
        type: 'select',
        default: '256',
        width: 'half',
        options: [
          { value: '256', label: '256 bits' },
          { value: '512', label: '512 bits' },
        ],
      },
    ],
    run: ({ input, params }) => digestOutput(blake3(input, { dkLen: Number(params.bits ?? '256') / 8 })),
  },
  {
    id: 'crc32',
    name: 'CRC-32',
    category: 'hash',
    action: 'hash',
    badge: 'legacy',
    run: async ({ input }) => {
      const { crc32 } = await import('hash-wasm')
      const hex = await crc32(input)
      const bytes = fromHex(hex.padStart(8, '0'))
      return {
        bytes: utf8(hex),
        text: hex,
        metas: [
          { label: 'meta.base64', value: bytesToBase64(bytes), mono: true },
          { label: 'meta.decimal', value: String(Number.parseInt(hex, 16)) },
        ],
      }
    },
  },
  {
    id: 'hmac',
    name: 'HMAC',
    category: 'hash',
    action: 'hash',
    params: [
      {
        id: 'key',
        label: 'p.key',
        type: 'password',
        placeholder: 'clau secreta',
        required: true,
      },
      {
        id: 'keyFormat',
        label: 'p.keyFormat',
        type: 'select',
        default: 'text',
        width: 'half',
        options: [
          { value: 'text', label: 'opt.text' },
          { value: 'hex', label: 'opt.hex' },
        ],
      },
      {
        id: 'hashAlgo',
        label: 'p.hashAlgo',
        type: 'select',
        default: 'SHA-256',
        width: 'half',
        options: [
          { value: 'SHA-256', label: 'SHA-256' },
          { value: 'SHA-512', label: 'SHA-512' },
        ],
      },
    ],
    run: async ({ input, params }) => {
      const keyBytes =
        params.keyFormat === 'hex' ? fromHex(params.key ?? '') : utf8(params.key ?? '')
      if (keyBytes.length === 0) fail('invalid_params', 'key')
      const algorithm = params.hashAlgo === 'SHA-512' ? 'SHA-512' : 'SHA-256'
      const key = await crypto.subtle.importKey(
        'raw',
        ab(keyBytes),
        { name: 'HMAC', hash: algorithm },
        false,
        ['sign'],
      )
      const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, ab(input)))
      return digestOutput(signature)
    },
  },
  {
    id: 'bcrypt',
    name: 'bcrypt',
    category: 'hash',
    action: 'hash',
    accepts: 'text',
    fileSupport: false,
    params: [
      {
        id: 'cost',
        label: 'p.bcryptCost',
        type: 'select',
        default: '12',
        width: 'half',
        options: [
          { value: '10', label: '10 (~100 ms)' },
          { value: '12', label: '12 (~400 ms)' },
          { value: '14', label: '14 (~1.5 s)' },
        ],
      },
    ],
    run: async ({ input, params }) => {
      const { bcrypt } = await import('hash-wasm')
      const salt = randomBytes(16)
      const hash = await bcrypt({
        password: passwordOf(input),
        salt,
        costFactor: Number(params.cost ?? '12'),
        outputType: 'encoded',
      })
      return {
        bytes: utf8(hash),
        text: hash,
        metas: [{ label: 'meta.salt', value: bytesToBase64(salt), mono: true }],
        noteKeys: ['note.bcrypt'],
      }
    },
  },
  {
    id: 'argon2id',
    name: 'Argon2id',
    category: 'hash',
    action: 'hash',
    accepts: 'text',
    fileSupport: false,
    params: [
      {
        id: 'memory',
        label: 'p.memory',
        type: 'select',
        default: '65536',
        width: 'half',
        options: [
          { value: '19456', label: '19 MiB' },
          { value: '65536', label: '64 MiB' },
          { value: '262144', label: '256 MiB' },
        ],
      },
      {
        id: 'iterations',
        label: 'p.iterations',
        type: 'select',
        default: '3',
        width: 'half',
        options: [
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
        ],
      },
    ],
    run: async ({ input, params }) => {
      const { argon2id } = await import('hash-wasm')
      const hash = await argon2id({
        password: passwordOf(input),
        salt: randomBytes(16),
        memorySize: Number(params.memory ?? '65536'),
        iterations: Number(params.iterations ?? '3'),
        parallelism: 1,
        hashLength: 32,
        outputType: 'encoded',
      })
      return { bytes: utf8(hash), text: hash, noteKeys: ['note.argon2'] }
    },
  },
  {
    id: 'scrypt',
    name: 'scrypt',
    category: 'hash',
    action: 'hash',
    accepts: 'text',
    fileSupport: false,
    params: [
      {
        id: 'scryptN',
        label: 'p.scryptN',
        type: 'select',
        default: '16384',
        width: 'half',
        options: [
          { value: '16384', label: 'N=16384 (16 MiB)' },
          { value: '32768', label: 'N=32768 (32 MiB)' },
          { value: '65536', label: 'N=65536 (64 MiB)' },
        ],
      },
    ],
    run: async ({ input, params }) => {
      const { scrypt } = await import('hash-wasm')
      const salt = randomBytes(16)
      const hash = await scrypt({
        password: passwordOf(input),
        salt,
        costFactor: Number(params.scryptN ?? '16384'),
        blockSize: 8,
        parallelism: 1,
        hashLength: 32,
      })
      return {
        bytes: utf8(hash),
        text: hash,
        metas: [{ label: 'meta.salt', value: bytesToBase64(salt), mono: true }],
        noteKeys: ['note.scrypt'],
      }
    },
  },
]
