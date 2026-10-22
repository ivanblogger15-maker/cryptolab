import { bytesToBase64, fromBase64, fromHex, randomBytes, safeBaseName, toHex, utf8 } from '../bytes'
import { fail } from '../errors'
import { toPem } from '../pem'
import { seal, unseal } from '../seal'
import type { ParamDef, RunContext, Tool, ToolOutput } from '../types'
import {
  ab,
  aesGcmDecrypt,
  aesGcmEncrypt,
  exportPrivatePem,
  exportPublicPem,
  importPrivateKey,
  importPublicKey,
  subtle,
} from '../webcrypto'
import { sha256 } from '@noble/hashes/sha2.js'

const RSA_OAEP: RsaHashedImportParams = { name: 'RSA-OAEP', hash: 'SHA-256' }
const ECDH_P256: EcKeyImportParams = { name: 'ECDH', namedCurve: 'P-256' }

function fileLabel(ctx: RunContext, suffix: string): string | undefined {
  return ctx.fileName ? `${safeBaseName(ctx.fileName)}${suffix}` : undefined
}

function pemParam(id: 'publicKey' | 'privateKey', direction: 'encode' | 'decode'): ParamDef {
  return {
    id,
    label: id === 'publicKey' ? 'p.publicKey' : 'p.privateKey',
    type: 'textarea',
    placeholder: '-----BEGIN PUBLIC KEY-----',
    mono: true,
    required: true,
    showIf: (_params, current) => current === direction,
  }
}

/* ------------------------------------------------------------------ RSA hybrid */

async function rsaEncrypt(ctx: RunContext): Promise<ToolOutput> {
  const publicPem = ctx.params.publicKey ?? ''
  if (!publicPem.trim()) fail('invalid_params', 'publicKey')
  const rsaKey = await importPublicKey(publicPem, RSA_OAEP)
  const aesKey = randomBytes(32)
  const iv = randomBytes(12)
  const payload = await aesGcmEncrypt(aesKey, iv, ctx.input)
  const wrappedKey = new Uint8Array(
    await subtle().encrypt({ name: 'RSA-OAEP' }, rsaKey, ab(aesKey)),
  )
  const header = {
    v: 1,
    algo: 'rsa-oaep',
    iv: bytesToBase64(iv),
    wrappedKey: bytesToBase64(wrappedKey),
    name: ctx.fileName,
    mime: ctx.mime,
  }
  return {
    bytes: seal(header, payload),
    filename: fileLabel(ctx, '.rsa.clab'),
    mime: 'application/octet-stream',
    metas: [
      { label: 'meta.algorithm', value: 'RSA-OAEP (SHA-256) + AES-256-GCM' },
      { label: 'meta.aesKey', value: '256 bits (embolcallada)' },
    ],
    noteKeys: ['note.rsaHybrid'],
  }
}

async function rsaDecrypt(ctx: RunContext): Promise<ToolOutput> {
  const privatePem = ctx.params.privateKey ?? ''
  if (!privatePem.trim()) fail('invalid_params', 'privateKey')
  const sealed = unseal(ctx.input)
  if (!sealed) fail('no_container')
  if (sealed.header.algo !== 'rsa-oaep') fail('invalid_params', sealed.header.algo)
  if (!sealed.header.wrappedKey || !sealed.header.iv) fail('invalid_params', 'header')
  const rsaKey = await importPrivateKey(privatePem, RSA_OAEP)
  let aesKey: Uint8Array
  try {
    aesKey = new Uint8Array(
      await subtle().decrypt(
        { name: 'RSA-OAEP' },
        rsaKey,
        ab(fromBase64(sealed.header.wrappedKey)),
      ),
    )
  } catch {
    fail('decrypt_failed')
  }
  const plain = await aesGcmDecrypt(aesKey, fromBase64(sealed.header.iv), sealed.payload)
  return {
    bytes: plain,
    filename: sealed.header.name,
    mime: sealed.header.mime ?? 'application/octet-stream',
    metas: [
      { label: 'meta.algorithm', value: 'RSA-OAEP (SHA-256) + AES-256-GCM' },
      { label: 'meta.size', value: `${plain.length} bytes` },
    ],
    noteKeys: ['note.localOnly'],
  }
}

/* ------------------------------------------------------------------ ECDH (ECIES) */

async function ecdhEncrypt(ctx: RunContext): Promise<ToolOutput> {
  const publicPem = ctx.params.publicKey ?? ''
  if (!publicPem.trim()) fail('invalid_params', 'publicKey')
  const peerKey = await importPublicKey(publicPem, ECDH_P256)
  const ephemeral = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  const shared = new Uint8Array(
    await subtle().deriveBits({ name: 'ECDH', public: peerKey }, ephemeral.privateKey, 256),
  )
  const aesKey = sha256(shared)
  const iv = randomBytes(12)
  const payload = await aesGcmEncrypt(aesKey, iv, ctx.input)
  const epk = new Uint8Array(await subtle().exportKey('spki', ephemeral.publicKey))
  const header = {
    v: 1,
    algo: 'ecdh-encrypt',
    iv: bytesToBase64(iv),
    epk: bytesToBase64(epk),
    name: ctx.fileName,
    mime: ctx.mime,
  }
  return {
    bytes: seal(header, payload),
    filename: fileLabel(ctx, '.ecdh.clab'),
    mime: 'application/octet-stream',
    metas: [
      { label: 'meta.algorithm', value: 'ECDH P-256 + AES-256-GCM' },
      { label: 'meta.ephemeralKey', value: 'P-256' },
    ],
    noteKeys: ['note.ecies'],
  }
}

async function ecdhDecrypt(ctx: RunContext): Promise<ToolOutput> {
  const privatePem = ctx.params.privateKey ?? ''
  if (!privatePem.trim()) fail('invalid_params', 'privateKey')
  const sealed = unseal(ctx.input)
  if (!sealed) fail('no_container')
  if (sealed.header.algo !== 'ecdh-encrypt') fail('invalid_params', sealed.header.algo)
  if (!sealed.header.epk || !sealed.header.iv) fail('invalid_params', 'header')
  const privateKey = await importPrivateKey(privatePem, ECDH_P256)
  const epkPem = toPem('PUBLIC KEY', fromBase64(sealed.header.epk))
  const ephemeralPublic = await importPublicKey(epkPem, ECDH_P256)
  const shared = new Uint8Array(
    await subtle().deriveBits({ name: 'ECDH', public: ephemeralPublic }, privateKey, 256),
  )
  const aesKey = sha256(shared)
  const plain = await aesGcmDecrypt(aesKey, fromBase64(sealed.header.iv), sealed.payload)
  return {
    bytes: plain,
    filename: sealed.header.name,
    mime: sealed.header.mime ?? 'application/octet-stream',
    metas: [
      { label: 'meta.algorithm', value: 'ECDH P-256 + AES-256-GCM' },
      { label: 'meta.size', value: `${plain.length} bytes` },
    ],
    noteKeys: ['note.localOnly'],
  }
}

/* ------------------------------------------------------------------ signatures */

interface SignAlgorithm {
  id: string
  name: string
  importParams: RsaHashedImportParams | EcKeyImportParams | Algorithm
  signParams: AlgorithmIdentifier | RsaPssParams | EcdsaParams
  verifyParams: AlgorithmIdentifier | RsaPssParams | EcdsaParams
  describe: string
}

const signAlgorithms: SignAlgorithm[] = [
  {
    id: 'ed25519',
    name: 'Ed25519',
    importParams: { name: 'Ed25519' },
    signParams: { name: 'Ed25519' },
    verifyParams: { name: 'Ed25519' },
    describe: 'Ed25519 (EdDSA)',
  },
  {
    id: 'ecdsa',
    name: 'ECDSA P-256',
    importParams: { name: 'ECDSA', namedCurve: 'P-256' },
    signParams: { name: 'ECDSA', hash: 'SHA-256' },
    verifyParams: { name: 'ECDSA', hash: 'SHA-256' },
    describe: 'ECDSA P-256 + SHA-256',
  },
  {
    id: 'rsa-pss',
    name: 'RSA-PSS',
    importParams: { name: 'RSA-PSS', hash: 'SHA-256' },
    signParams: { name: 'RSA-PSS', saltLength: 32 },
    verifyParams: { name: 'RSA-PSS', saltLength: 32 },
    describe: 'RSA-PSS + SHA-256 (salt 32)',
  },
]

function signParams(): ParamDef[] {
  return [
    pemParam('privateKey', 'encode'),
    pemParam('publicKey', 'decode'),
    {
      id: 'signature',
      label: 'p.signature',
      type: 'textarea',
      placeholder: 'signatura en base64 o hex',
      mono: true,
      required: true,
      showIf: (_params, direction) => direction === 'decode',
    },
    {
      id: 'sigFormat',
      label: 'p.signatureFormat',
      type: 'select',
      default: 'base64',
      width: 'half',
      options: [
        { value: 'base64', label: 'Base64' },
        { value: 'hex', label: 'Hex' },
      ],
    },
  ]
}

async function signWith(ctx: RunContext, algo: SignAlgorithm): Promise<ToolOutput> {
  const pem = ctx.params.privateKey ?? ''
  if (!pem.trim()) fail('invalid_params', 'privateKey')
  const key = await importPrivateKey(pem, algo.importParams)
  const signature = new Uint8Array(await subtle().sign(algo.signParams, key, ab(ctx.input)))
  const format = ctx.params.sigFormat ?? 'base64'
  const signatureText = format === 'hex' ? toHex(signature) : bytesToBase64(signature)
  return {
    bytes: utf8(signatureText),
    text: signatureText,
    filename: fileLabel(ctx, '.sig.txt'),
    metas: [
      { label: 'meta.algorithm', value: algo.describe },
      { label: 'meta.size', value: `${signature.length} bytes` },
    ],
    noteKeys: ['note.signature'],
  }
}

async function verifyWith(ctx: RunContext, algo: SignAlgorithm): Promise<ToolOutput> {
  const pem = ctx.params.publicKey ?? ''
  if (!pem.trim()) fail('invalid_params', 'publicKey')
  const signatureText = (ctx.params.signature ?? '').trim()
  if (!signatureText) fail('invalid_params', 'signature')
  let signature: Uint8Array
  const format = ctx.params.sigFormat ?? 'base64'
  if (format === 'hex') {
    signature = fromHex(signatureText)
  } else {
    try {
      signature = fromBase64(signatureText)
    } catch {
      signature = fromHex(signatureText)
    }
  }
  const key = await importPublicKey(pem, algo.importParams)
  let valid = false
  try {
    valid = await subtle().verify(algo.verifyParams, key, ab(signature), ab(ctx.input))
  } catch {
    valid = false
  }
  const text = valid ? 'VALID' : 'INVALID'
  return {
    bytes: utf8(text),
    text,
    status: valid ? 'valid' : 'invalid',
    metas: [
      { label: 'meta.algorithm', value: algo.describe },
      { label: 'meta.signature', value: `${signature.length} bytes` },
    ],
    noteKeys: valid ? ['note.validSignature'] : ['note.invalidSignature'],
  }
}

/* ------------------------------------------------------------------ ECDH shared secret */

async function ecdhShared(ctx: RunContext): Promise<ToolOutput> {
  const privatePem = ctx.params.privateKey ?? ''
  const publicPem = ctx.params.publicKey ?? ''
  if (!privatePem.trim() || !publicPem.trim()) fail('invalid_params', 'keys')
  const privateKey = await importPrivateKey(privatePem, ECDH_P256)
  const publicKey = await importPublicKey(publicPem, ECDH_P256)
  const shared = new Uint8Array(
    await subtle().deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256),
  )
  const hex = toHex(shared)
  return {
    bytes: utf8(hex),
    text: hex,
    metas: [{ label: 'meta.base64', value: bytesToBase64(shared), mono: true }],
    noteKeys: ['note.sharedSecret'],
  }
}

/* ------------------------------------------------------------------ key generation */

const keyTypes = [
  'rsa-oaep-2048',
  'rsa-oaep-3072',
  'rsa-oaep-4096',
  'rsa-pss-2048',
  'rsa-pss-3072',
  'ecdh-p256',
  'ecdh-p384',
  'ecdsa-p256',
  'ecdsa-p384',
  'ed25519',
] as const

type KeyType = (typeof keyTypes)[number]

async function generateKeyPair(type: KeyType): Promise<CryptoKeyPair> {
  if (type.startsWith('rsa-')) {
    const [, mode, bits] = type.split('-')
    const name = mode === 'oaep' ? 'RSA-OAEP' : 'RSA-PSS'
    if (name === 'RSA-OAEP') {
      return subtle().generateKey(
        {
          name,
          modulusLength: Number(bits),
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt'],
      )
    }
    return subtle().generateKey(
      {
        name,
        modulusLength: Number(bits),
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )
  }
  if (type.startsWith('ecdh-') || type.startsWith('ecdsa-')) {
    const name = type.startsWith('ecdh') ? 'ECDH' : 'ECDSA'
    const curve = type.endsWith('p384') ? 'P-384' : 'P-256'
    return subtle().generateKey({ name, namedCurve: curve }, true, name === 'ECDH' ? ['deriveBits'] : ['sign', 'verify'])
  }
  return subtle().generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
}

async function keygen(ctx: RunContext): Promise<ToolOutput> {
  const requested = (ctx.params.type ?? 'ed25519') as KeyType
  const type: KeyType = keyTypes.includes(requested) ? requested : 'ed25519'
  const pair = await generateKeyPair(type)
  const publicPem = await exportPublicPem(pair.publicKey)
  const privatePem = await exportPrivatePem(pair.privateKey)
  const combined = `${publicPem}\n\n${privatePem}`
  const basename = `cryptolab-${type}`
  return {
    bytes: utf8(combined),
    text: combined,
    blocks: [
      {
        label: 'p.publicKey',
        text: publicPem,
        filename: `${basename}-public.pem`,
      },
      {
        label: 'p.privateKey',
        text: privatePem,
        filename: `${basename}-private.pem`,
        hint: 'p.keepPrivate',
      },
    ],
    metas: [
      { label: 'meta.type', value: type },
      { label: 'meta.format', value: 'PEM (SPKI / PKCS#8)' },
    ],
    noteKeys: ['note.keygen'],
  }
}

/* ------------------------------------------------------------------ registry */

export const asymmetricTools: Tool[] = [
  {
    id: 'rsa-oaep',
    name: 'RSA-OAEP (híbrid)',
    category: 'asymmetric',
    action: 'encrypt',
    reversible: true,
    badge: 'recommended',
    params: [pemParam('publicKey', 'encode'), pemParam('privateKey', 'decode')],
    run: (ctx) => (ctx.direction === 'encode' ? rsaEncrypt(ctx) : rsaDecrypt(ctx)),
  },
  {
    id: 'ecdh-encrypt',
    name: 'ECIES (ECDH + AES)',
    category: 'asymmetric',
    action: 'encrypt',
    reversible: true,
    badge: 'recommended',
    params: [pemParam('publicKey', 'encode'), pemParam('privateKey', 'decode')],
    run: (ctx) => (ctx.direction === 'encode' ? ecdhEncrypt(ctx) : ecdhDecrypt(ctx)),
  },
  ...signAlgorithms.map((algo) => ({
    id: algo.id,
    name: algo.name,
    category: 'asymmetric' as const,
    action: 'sign' as const,
    reversible: true,
    params: signParams(),
    run: (ctx: RunContext) => (ctx.direction === 'encode' ? signWith(ctx, algo) : verifyWith(ctx, algo)),
  })),
  {
    id: 'ecdh-shared',
    name: 'ECDH (secret compartit)',
    category: 'asymmetric',
    action: 'generate',
    noInput: true,
    fileSupport: false,
    params: [pemParam('privateKey', 'encode'), pemParam('publicKey', 'encode')],
    run: ecdhShared,
  },
  {
    id: 'keygen',
    name: 'Generador de claus',
    category: 'asymmetric',
    action: 'generate',
    noInput: true,
    fileSupport: false,
    params: [
      {
        id: 'type',
        label: 'p.keyType',
        type: 'select',
        default: 'ed25519',
        options: keyTypes.map((type) => ({ value: type, label: type.toUpperCase() })),
      },
    ],
    run: keygen,
  },
]
