import { bytesToBase64, fromHex, randomBytes, toHex, utf8 } from '../bytes'
import { fail } from '../errors'
import { deriveKey, kdfLabel, makeKdfSpec, type KdfId } from '../kdf'
import type { ParamDef, Params, Tool } from '../types'

function saltOf(params: Params): Uint8Array {
  const hex = (params.salt ?? '').trim()
  if (hex.length === 0) return randomBytes(16)
  const salt = fromHex(hex)
  if (salt.length < 8) fail('invalid_params', 'salt')
  return salt
}

function kdfTool(
  id: string,
  name: string,
  kdf: KdfId,
  extraParams: ParamDef[] = [],
): Tool {
  return {
    id,
    name,
    category: 'kdf',
    action: 'generate',
    noInput: true,
    fileSupport: false,
    params: [
      {
        id: 'passphrase',
        label: 'p.passphrase',
        type: 'password',
        required: true,
      },
      {
        id: 'salt',
        label: 'p.salt',
        type: 'text',
        placeholder: 'hex (buit = aleatori)',
        mono: true,
        width: 'half',
        help: 'p.saltHelp',
      },
      ...extraParams,
    ],
    run: async ({ params }) => {
      if (!(params.passphrase ?? '').trim()) fail('invalid_params', 'passphrase')
      const salt = saltOf(params)
      const spec = makeKdfSpec(kdf, params, salt)
      const key = await deriveKey(params.passphrase ?? '', spec)
      const hex = toHex(key)
      return {
        bytes: utf8(hex),
        text: hex,
        metas: [
          { label: 'meta.kdf', value: kdfLabel(spec) },
          { label: 'meta.salt', value: toHex(salt), mono: true },
          { label: 'meta.base64', value: bytesToBase64(key), mono: true },
        ],
        noteKeys: ['note.kdfSalt'],
      }
    },
  }
}

const PASSWORD_CHARSETS: Record<string, string> = {
  full: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{};:,.?/',
  alnum: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789',
  hex: '0123456789abcdef',
  numeric: '0123456789',
}

function randomPassword(length: number, charset: string): string {
  const alphabet = PASSWORD_CHARSETS[charset] ?? PASSWORD_CHARSETS.full
  const max = Math.floor(256 / alphabet.length) * alphabet.length
  let out = ''
  while (out.length < length) {
    for (const byte of randomBytes(Math.max(16, length))) {
      if (byte >= max) continue
      out += alphabet[byte % alphabet.length]
      if (out.length === length) break
    }
  }
  return out
}

export const kdfTools: Tool[] = [
  kdfTool('pbkdf2', 'PBKDF2', 'pbkdf2', [
    {
      id: 'iterations',
      label: 'p.iterations',
      type: 'number',
      default: '600000',
      min: 1000,
      max: 10000000,
      width: 'half',
    },
  ]),
  kdfTool('scrypt-kdf', 'scrypt (KDF)', 'scrypt', [
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
  ]),
  kdfTool('argon2id-kdf', 'Argon2id (KDF)', 'argon2id', [
    {
      id: 'argonMemory',
      label: 'p.argonMemory',
      type: 'select',
      default: '65536',
      width: 'half',
      options: [
        { value: '19456', label: '19 MiB' },
        { value: '65536', label: '64 MiB' },
        { value: '262144', label: '256 MiB' },
      ],
    },
  ]),
  {
    id: 'random',
    name: 'Generador aleatori',
    category: 'kdf',
    action: 'generate',
    noInput: true,
    fileSupport: false,
    params: [
      {
        id: 'mode',
        label: 'p.randomMode',
        type: 'select',
        default: 'password',
        width: 'half',
        options: [
          { value: 'password', label: 'opt.password' },
          { value: 'bytes', label: 'opt.randomBytes' },
          { value: 'uuid', label: 'opt.uuid' },
        ],
      },
      {
        id: 'length',
        label: 'p.length',
        type: 'number',
        default: '32',
        min: 4,
        max: 4096,
        width: 'half',
        showIf: (params) => (params.mode ?? 'password') !== 'uuid',
      },
      {
        id: 'charset',
        label: 'p.charset',
        type: 'select',
        default: 'full',
        width: 'half',
        showIf: (params) => (params.mode ?? 'password') === 'password',
        options: [
          { value: 'full', label: 'A-Z a-z 0-9 + símbols' },
          { value: 'alnum', label: 'A-Z a-z 0-9' },
          { value: 'hex', label: 'Hex' },
          { value: 'numeric', label: '0-9' },
        ],
      },
      {
        id: 'count',
        label: 'p.count',
        type: 'number',
        default: '1',
        min: 1,
        max: 50,
        width: 'half',
        showIf: (params) => (params.mode ?? 'password') === 'uuid',
      },
    ],
    run: ({ params }) => {
      const mode = params.mode ?? 'password'
      const length = Math.min(4096, Math.max(4, Number.parseInt(params.length ?? '32', 10) || 32))
      if (mode === 'uuid') {
        const count = Math.min(50, Math.max(1, Number.parseInt(params.count ?? '1', 10) || 1))
        const list = Array.from({ length: count }, () => crypto.randomUUID()).join('\n')
        return { bytes: utf8(list), text: list, noteKeys: ['note.uuid'] }
      }
      if (mode === 'bytes') {
        const bytes = randomBytes(length)
        const hex = toHex(bytes)
        return {
          bytes: utf8(hex),
          text: hex,
        metas: [{ label: 'meta.base64', value: bytesToBase64(bytes), mono: true }],
          noteKeys: ['note.random'],
        }
      }
      const password = randomPassword(length, params.charset ?? 'full')
      return {
        bytes: utf8(password),
        text: password,
        metas: [{ label: 'meta.entropy', value: `${length}` }],
        noteKeys: ['note.random'],
      }
    },
  },
]
