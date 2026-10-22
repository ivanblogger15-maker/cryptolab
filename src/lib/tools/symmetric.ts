import { chacha20, chacha20poly1305, xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { salsa20, xsalsa20poly1305 } from '@noble/ciphers/salsa.js'
import { bytesToBase64, fromBase64, fromHex, randomBytes, safeBaseName, toHex } from '../bytes'
import { fail } from '../errors'
import {
  DEFAULT_ITERATIONS,
  deriveKey,
  kdfLabel,
  makeKdfSpec,
  type KdfId,
  type KdfSpec,
} from '../kdf'
import { seal, unseal } from '../seal'
import type { ParamDef, Params, RunContext, Tool, ToolOutput } from '../types'
import { aesCbcDecrypt, aesCbcEncrypt, aesCtrTransform, aesGcmDecrypt, aesGcmEncrypt } from '../webcrypto'

interface SymAlgorithm {
  id: string
  name: string
  keyLength: number
  nonceLength: number
  encrypt: (key: Uint8Array, nonce: Uint8Array, data: Uint8Array) => Promise<Uint8Array>
  decrypt: (key: Uint8Array, nonce: Uint8Array, data: Uint8Array) => Promise<Uint8Array>
  authenticated: boolean
  badge?: 'recommended' | 'legacy' | 'insecure'
}

async function nobleDecrypt(
  fn: () => Uint8Array | Promise<Uint8Array>,
): Promise<Uint8Array> {
  try {
    return await fn()
  } catch {
    fail('decrypt_failed')
  }
}

const algorithms: SymAlgorithm[] = [
  {
    id: 'aes-gcm',
    name: 'AES-256-GCM',
    keyLength: 32,
    nonceLength: 12,
    authenticated: true,
    badge: 'recommended',
    encrypt: (key, iv, data) => aesGcmEncrypt(key, iv, data),
    decrypt: (key, iv, data) => aesGcmDecrypt(key, iv, data),
  },
  {
    id: 'chacha20-poly1305',
    name: 'ChaCha20-Poly1305',
    keyLength: 32,
    nonceLength: 12,
    authenticated: true,
    badge: 'recommended',
    encrypt: async (key, iv, data) => chacha20poly1305(key, iv).encrypt(data),
    decrypt: async (key, iv, data) => nobleDecrypt(() => chacha20poly1305(key, iv).decrypt(data)),
  },
  {
    id: 'xchacha20-poly1305',
    name: 'XChaCha20-Poly1305',
    keyLength: 32,
    nonceLength: 24,
    authenticated: true,
    badge: 'recommended',
    encrypt: async (key, iv, data) => xchacha20poly1305(key, iv).encrypt(data),
    decrypt: async (key, iv, data) => nobleDecrypt(() => xchacha20poly1305(key, iv).decrypt(data)),
  },
  {
    id: 'xsalsa20-poly1305',
    name: 'XSalsa20-Poly1305',
    keyLength: 32,
    nonceLength: 24,
    authenticated: true,
    encrypt: async (key, iv, data) => xsalsa20poly1305(key, iv).encrypt(data),
    decrypt: async (key, iv, data) => nobleDecrypt(() => xsalsa20poly1305(key, iv).decrypt(data)),
  },
  {
    id: 'aes-cbc',
    name: 'AES-256-CBC',
    keyLength: 32,
    nonceLength: 16,
    authenticated: false,
    badge: 'legacy',
    encrypt: (key, iv, data) => aesCbcEncrypt(key, iv, data),
    decrypt: (key, iv, data) => aesCbcDecrypt(key, iv, data),
  },
  {
    id: 'aes-ctr',
    name: 'AES-256-CTR',
    keyLength: 32,
    nonceLength: 16,
    authenticated: false,
    badge: 'legacy',
    encrypt: (key, iv, data) => aesCtrTransform(key, iv, data, 'encrypt'),
    decrypt: (key, iv, data) => aesCtrTransform(key, iv, data, 'decrypt'),
  },
  {
    id: 'chacha20',
    name: 'ChaCha20',
    keyLength: 32,
    nonceLength: 12,
    authenticated: false,
    badge: 'legacy',
    encrypt: async (key, iv, data) => chacha20(key, iv, data),
    decrypt: async (key, iv, data) => chacha20(key, iv, data),
  },
  {
    id: 'salsa20',
    name: 'Salsa20',
    keyLength: 32,
    nonceLength: 8,
    authenticated: false,
    badge: 'legacy',
    encrypt: async (key, iv, data) => salsa20(key, iv, data),
    decrypt: async (key, iv, data) => salsa20(key, iv, data),
  },
]

function isPassphrase(params: Params): boolean {
  return (params.keyMode ?? 'passphrase') === 'passphrase'
}

function kdfIdOf(params: Params): KdfId {
  const value = params.kdf
  return value === 'scrypt' || value === 'argon2id' ? value : 'pbkdf2'
}

function symParams(): ParamDef[] {
  return [
    {
      id: 'keyMode',
      label: 'p.keySource',
      type: 'select',
      default: 'passphrase',
      width: 'half',
      showIf: (_params, direction) => direction === 'encode',
      options: [
        { value: 'passphrase', label: 'opt.passphrase' },
        { value: 'hex', label: 'opt.rawKey' },
      ],
    },
    {
      id: 'kdf',
      label: 'p.kdf',
      type: 'select',
      default: 'pbkdf2',
      width: 'half',
      showIf: (params, direction) => direction === 'encode' && isPassphrase(params),
      options: [
        { value: 'pbkdf2', label: 'PBKDF2-SHA256' },
        { value: 'scrypt', label: 'scrypt' },
        { value: 'argon2id', label: 'Argon2id' },
      ],
    },
    {
      id: 'passphrase',
      label: 'p.passphrase',
      type: 'password',
      placeholder: '…',
      showIf: (params, direction) => direction === 'decode' || isPassphrase(params),
    },
    {
      id: 'keyHex',
      label: 'p.rawKey',
      type: 'password',
      placeholder: '64 caràcters hex',
      mono: true,
      showIf: (params, direction) => direction === 'decode' || !isPassphrase(params),
    },
    {
      id: 'iterations',
      label: 'p.iterations',
      type: 'number',
      default: String(DEFAULT_ITERATIONS),
      min: 1000,
      max: 10000000,
      width: 'half',
      showIf: (params) => isPassphrase(params) && kdfIdOf(params) === 'pbkdf2',
    },
    {
      id: 'scryptN',
      label: 'p.scryptN',
      type: 'select',
      default: '16384',
      width: 'half',
      showIf: (params) => isPassphrase(params) && kdfIdOf(params) === 'scrypt',
      options: [
        { value: '16384', label: 'N=16384 (16 MiB)' },
        { value: '32768', label: 'N=32768 (32 MiB)' },
        { value: '65536', label: 'N=65536 (64 MiB)' },
      ],
    },
    {
      id: 'argonMemory',
      label: 'p.argonMemory',
      type: 'select',
      default: '65536',
      width: 'half',
      showIf: (params) => isPassphrase(params) && kdfIdOf(params) === 'argon2id',
      options: [
        { value: '19456', label: '19 MiB' },
        { value: '65536', label: '64 MiB' },
        { value: '262144', label: '256 MiB' },
      ],
    },
    {
      id: 'iv',
      label: 'p.iv',
      type: 'text',
      placeholder: 'hex (només sense capçalera)',
      mono: true,
      width: 'half',
      showIf: (_params, direction) => direction === 'decode',
      help: 'p.ivHelp',
    },
    {
      id: 'salt',
      label: 'p.salt',
      type: 'text',
      placeholder: 'hex (només sense capçalera)',
      mono: true,
      width: 'half',
      showIf: (params, direction) => direction === 'decode' && isPassphrase(params),
      help: 'p.saltHelp',
    },
  ]
}

async function resolveKey(
  params: Params,
  saltOverride?: string,
): Promise<{ key: Uint8Array; kdf: KdfSpec | undefined }> {
  if (!isPassphrase(params)) {
    const key = fromHex(params.keyHex ?? '')
    if (key.length === 0) fail('invalid_params', 'key')
    return { key, kdf: undefined }
  }
  const passphrase = params.passphrase ?? ''
  if (passphrase.length === 0) fail('invalid_params', 'passphrase')
  const salt = saltOverride ? fromHex(saltOverride) : randomBytes(16)
  if (salt.length < 8) fail('invalid_params', 'salt')
  const kdf = makeKdfSpec(kdfIdOf(params), params, salt)
  const key = await deriveKey(passphrase, kdf)
  return { key, kdf }
}

function checkKey(key: Uint8Array, algo: SymAlgorithm): void {
  if (key.length !== algo.keyLength) {
    fail('invalid_key_length', `${key.length} bytes (esperats ${algo.keyLength})`)
  }
}

async function encryptWith(ctx: RunContext, algo: SymAlgorithm): Promise<ToolOutput> {
  if (ctx.input.length === 0) fail('empty_input')
  const { key, kdf } = await resolveKey(ctx.params)
  checkKey(key, algo)
  const iv = randomBytes(algo.nonceLength)
  const payload = await algo.encrypt(key, iv, ctx.input)
  const header = {
    v: 1,
    algo: algo.id,
    iv: bytesToBase64(iv),
    kdf,
    name: ctx.fileName,
    mime: ctx.mime,
  }
  const metas = [
    { label: 'meta.algorithm', value: algo.name },
    ...(kdf ? [{ label: 'meta.kdf', value: kdfLabel(kdf) }] : []),
    { label: 'meta.iv', value: toHex(iv) },
    { label: 'meta.size', value: `${payload.length} bytes` },
  ]
  return {
    bytes: seal(header, payload),
    filename: ctx.fileName ? `${safeBaseName(ctx.fileName)}.clab` : undefined,
    mime: 'application/octet-stream',
    metas,
    noteKeys: algo.authenticated ? ['note.sealed'] : ['note.sealed', 'note.unauth'],
  }
}

async function decryptWith(ctx: RunContext, algo: SymAlgorithm): Promise<ToolOutput> {
  if (ctx.input.length === 0) fail('empty_input')
  const sealed = unseal(ctx.input)
  let payload = ctx.input
  let iv: Uint8Array
  let kdfSpec: KdfSpec | undefined
  let headerName: string | undefined
  let headerMime: string | undefined
  const notes = ['note.localOnly']

  if (sealed) {
    if (sealed.header.algo !== algo.id) {
      fail('invalid_params', `algorisme: ${sealed.header.algo}`)
    }
    payload = sealed.payload
    if (!sealed.header.iv) fail('invalid_params', 'iv')
    iv = fromBase64(sealed.header.iv)
    kdfSpec = sealed.header.kdf
    headerName = sealed.header.name
    headerMime = sealed.header.mime
    notes.push('note.detected')
  } else {
    iv = fromHex(ctx.params.iv ?? '')
    if (iv.length === 0) fail('no_container')
    if (iv.length !== algo.nonceLength) fail('invalid_params', 'iv')
    if (isPassphrase(ctx.params)) {
      if (!ctx.params.salt) fail('no_container')
      const salt = fromHex(ctx.params.salt)
      if (salt.length < 8) fail('invalid_params', 'salt')
      kdfSpec = makeKdfSpec(kdfIdOf(ctx.params), ctx.params, salt)
    }
  }

  let key: Uint8Array
  if (kdfSpec) {
    const passphrase = ctx.params.passphrase ?? ''
    if (passphrase.length === 0) fail('invalid_params', 'passphrase')
    key = await deriveKey(passphrase, kdfSpec)
  } else {
    const raw = fromHex(ctx.params.keyHex ?? '')
    if (raw.length === 0) fail('invalid_params', 'key')
    key = raw
  }
  checkKey(key, algo)
  const plain = await algo.decrypt(key, iv, payload)

  const metas = [
    { label: 'meta.algorithm', value: algo.name },
    ...(kdfSpec ? [{ label: 'meta.kdf', value: kdfLabel(kdfSpec) }] : []),
    { label: 'meta.iv', value: toHex(iv) },
    { label: 'meta.size', value: `${plain.length} bytes` },
  ]
  if (!algo.authenticated) notes.push('note.unauth')

  return {
    bytes: plain,
    filename: headerName,
    mime: headerMime ?? 'application/octet-stream',
    metas,
    noteKeys: notes,
  }
}

export const symmetricTools: Tool[] = algorithms.map((algo) => ({
  id: algo.id,
  name: algo.name,
  category: 'symmetric',
  action: 'encrypt',
  reversible: true,
  badge: algo.badge,
  params: symParams(),
  run: (ctx) => (ctx.direction === 'encode' ? encryptWith(ctx, algo) : decryptWith(ctx, algo)),
}))
