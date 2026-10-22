import { describe, expect, it } from 'vitest'
import { tryUtf8, utf8 } from '../bytes'
import { ToolError } from '../errors'
import type { Direction, Params } from '../types'
import { ALL_TOOLS, TOOL_MAP } from './index'

function tool(id: string) {
  const found = TOOL_MAP.get(id)
  if (!found) throw new Error(`Unknown tool: ${id}`)
  return found
}

async function run(
  id: string,
  direction: Direction,
  input: string | Uint8Array,
  params: Params = {},
) {
  const bytes = typeof input === 'string' ? utf8(input) : input
  return tool(id).run({
    direction,
    input: bytes,
    text: tryUtf8(bytes) ?? '',
    params,
  })
}

async function textAt(id: string, direction: Direction, input: string, params: Params = {}) {
  const out = await run(id, direction, input, params)
  return out.text ?? new TextDecoder().decode(out.bytes)
}

const BYTE_CODECS = [
  'base64',
  'base64url',
  'base32',
  'base58',
  'base62',
  'base85',
  'hex',
  'binary',
  'octal',
  'decimal',
]

const TEXT_CODECS = ['url', 'html', 'unicode', 'a1z26', 'morse', 'bacon']
/** Codecs that only represent letters, so they normalise case and drop punctuation. */
const LETTER_CODECS = new Set(['a1z26', 'morse', 'bacon'])

describe('registry', () => {
  it('has unique tool ids', () => {
    const ids = ALL_TOOLS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('declares a category and a run function for every tool', () => {
    for (const t of ALL_TOOLS) {
      expect(t.category, t.id).toBeTruthy()
      expect(typeof t.run, t.id).toBe('function')
    }
  })
})

describe('encodings', () => {
  const samples = ['Hello, world!', 'àéîõü — 日本語 🚀', '']

  for (const id of BYTE_CODECS) {
    it(`${id} round-trips bytes`, async () => {
      const bytes = new Uint8Array([0x00, 0x01, 0x7f, 0x80, 0xff, 0x42])
      const encoded = await run(id, 'encode', bytes)
      expect(encoded.text).toBeTruthy()
      const decoded = await run(id, 'decode', encoded.text!)
      expect(Array.from(decoded.bytes)).toEqual(Array.from(bytes))
    })
  }

  for (const id of TEXT_CODECS) {
    it(`${id} round-trips text`, async () => {
      const inputs = LETTER_CODECS.has(id) ? ['HELLOWORLD'] : samples
      for (const sample of inputs) {
        const encoded = await textAt(id, 'encode', sample)
        const decoded = await textAt(id, 'decode', encoded)
        expect(decoded).toBe(sample)
      }
    })
  }

  it('base64 produces the RFC 4648 vector', async () => {
    expect(await textAt('base64', 'encode', 'foobar')).toBe('Zm9vYmFy')
  })

  it('hex produces lowercase output', async () => {
    expect(await textAt('hex', 'encode', 'AB')).toBe('4142')
  })

  it('morse encodes a known word', async () => {
    expect(await textAt('morse', 'encode', 'SOS')).toBe('... --- ...')
  })

  it('rejects invalid base64', async () => {
    await expect(run('base64', 'decode', '!!!!')).rejects.toBeInstanceOf(ToolError)
  })
})

describe('classical ciphers', () => {
  it('caesar shifts and restores', async () => {
    const encoded = await textAt('caesar', 'encode', 'Attack at dawn', { shift: '3' })
    expect(encoded).toBe('Dwwdfn dw gdzq')
    expect(await textAt('caesar', 'decode', encoded, { shift: '3' })).toBe('Attack at dawn')
  })

  it('caesar brute force lists 26 candidates', async () => {
    const out = await textAt('caesar', 'decode', 'Dwwdfn', { brute: 'true' })
    expect(out.split('\n')).toHaveLength(26)
    expect(out).toContain('ROT 03: Attack')
  })

  it('rot13 is its own inverse', async () => {
    const once = await textAt('rot13', 'encode', 'Hello')
    expect(once).toBe('Uryyb')
    expect(await textAt('rot13', 'encode', once)).toBe('Hello')
  })

  it('rot47 round-trips printable ASCII', async () => {
    const sample = 'Hello, World! 123'
    const encoded = await textAt('rot47', 'encode', sample)
    expect(encoded).not.toBe(sample)
    expect(await textAt('rot47', 'decode', encoded)).toBe(sample)
  })

  it('atbash is its own inverse', async () => {
    expect(await textAt('atbash', 'encode', 'Abc')).toBe('Zyx')
  })

  it('vigenere round-trips', async () => {
    const encoded = await textAt('vigenere', 'encode', 'Attack at dawn', { key: 'LEMON' })
    expect(encoded).toBe('Lxfopv ef rnhr')
    expect(await textAt('vigenere', 'decode', encoded, { key: 'LEMON' })).toBe('Attack at dawn')
  })

  it('affine round-trips', async () => {
    const encoded = await textAt('affine', 'encode', 'Affine cipher', { a: '5', b: '8' })
    expect(await textAt('affine', 'decode', encoded, { a: '5', b: '8' })).toBe('Affine cipher')
  })

  it('playfair round-trips uppercase letters', async () => {
    const encoded = await textAt('playfair', 'encode', 'HIDETHEGOLD', { key: 'MONARCHY' })
    expect(await textAt('playfair', 'decode', encoded, { key: 'MONARCHY' })).toBe('HIDETHEGOLD')
  })

  it('rail fence round-trips', async () => {
    const encoded = await textAt('railfence', 'encode', 'WEAREDISCOVEREDFLEEATONCE', { rails: '3' })
    expect(await textAt('railfence', 'decode', encoded, { rails: '3' })).toBe(
      'WEAREDISCOVEREDFLEEATONCE',
    )
  })

  it('columnar transposition round-trips', async () => {
    const encoded = await textAt('columnar', 'encode', 'CRYPTOLAB', { key: 'ZEBRA' })
    expect(await textAt('columnar', 'decode', encoded, { key: 'ZEBRA' })).toBe('CRYPTOLAB')
  })

  it('xor round-trips bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 250])
    const encoded = await run('xor', 'encode', bytes, { key: 'secret', keyFormat: 'text' })
    const decoded = await run('xor', 'decode', encoded.bytes, { key: 'secret', keyFormat: 'text' })
    expect(Array.from(decoded.bytes)).toEqual(Array.from(bytes))
  })

  it('one-time pad round-trips with a hex key', async () => {
    const key = 'deadbeef00ff'
    const encoded = await run('otp', 'encode', 'hello', { key })
    const decoded = await run('otp', 'decode', encoded.bytes, { key })
    expect(new TextDecoder().decode(decoded.bytes)).toBe('hello')
  })

  it('one-time pad rejects a short key', async () => {
    await expect(run('otp', 'encode', 'hello', { key: 'ff' })).rejects.toBeInstanceOf(ToolError)
  })
})

describe('hashes and MACs', () => {
  it('sha256 matches the known vector', async () => {
    expect(await textAt('sha256', 'encode', 'abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('sha1 matches the known vector', async () => {
    expect(await textAt('sha1', 'encode', 'abc')).toBe(
      'a9993e364706816aba3e25717850c26c9cd0d89d',
    )
  })

  it('md5 matches the known vector', async () => {
    expect(await textAt('md5', 'encode', 'abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('sha512 hashes the empty string', async () => {
    expect(await textAt('sha512', 'encode', '')).toBe(
      'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce' +
        '47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
    )
  })

  it('crc32 matches the known vector', async () => {
    expect(await textAt('crc32', 'encode', 'The quick brown fox jumps over the lazy dog')).toBe(
      '414fa339',
    )
  })

  it('hmac-sha256 matches the RFC 4231 vector', async () => {
    const out = await run('hmac', 'encode', 'what do ya want for nothing?', {
      key: 'Jefe',
      keyFormat: 'text',
      hashAlgo: 'SHA-256',
    })
    expect(out.text).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
  })

  it('blake3 hashes deterministically', async () => {
    expect(await textAt('blake3', 'encode', 'abc', { bits: '256' })).toBe(
      '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85',
    )
  })
})

describe('password KDFs', () => {
  it('bcrypt produces a PHC-style hash and rejects empty input', async () => {
    const hash = await textAt('bcrypt', 'encode', 'correct horse', { cost: '10' })
    expect(hash).toMatch(/^\$2[aby]\$10\$/)
    await expect(run('bcrypt', 'encode', '')).rejects.toBeInstanceOf(ToolError)
  })

  it('argon2id produces a PHC string', async () => {
    const out = await textAt('argon2id', 'encode', 'pw', { memory: '8192', iterations: '3' })
    expect(out.startsWith('$argon2id$')).toBe(true)
    expect(out).toContain('m=8192')
  })

  it('scrypt returns a 32-byte hex digest', async () => {
    const out = await textAt('scrypt', 'encode', 'pw', { scryptN: '16384' })
    expect(out).toMatch(/^[0-9a-f]{64}$/)
  })

  it('password hashes reject empty input', async () => {
    for (const id of ['argon2id', 'scrypt']) {
      await expect(run(id, 'encode', '')).rejects.toBeInstanceOf(ToolError)
    }
  })
})

describe('symmetric encryption', () => {
  const KEY_HEX = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'

  const algorithms = [
    'aes-gcm',
    'chacha20-poly1305',
    'xchacha20-poly1305',
    'xsalsa20-poly1305',
    'aes-cbc',
    'aes-ctr',
    'chacha20',
    'salsa20',
  ]

  for (const id of algorithms) {
    it(`${id} round-trips with a raw key`, async () => {
      const plain = utf8('CryptoLab round-trip ✓')
      const sealed = await run(id, 'encode', plain, { keyMode: 'hex', keyHex: KEY_HEX })
      expect(String.fromCharCode(...sealed.bytes.slice(0, 4))).toBe('CLAB')
      const opened = await run(id, 'decode', sealed.bytes, {
        keyMode: 'hex',
        keyHex: KEY_HEX,
      })
      expect(new TextDecoder().decode(opened.bytes)).toBe('CryptoLab round-trip ✓')
    })
  }

  it('aes-gcm works with a passphrase and no extra parameters', async () => {
    const sealed = await run('aes-gcm', 'encode', 'secret message', {
      keyMode: 'passphrase',
      passphrase: 'hunter2',
      iterations: '1000',
    })
    const opened = await run('aes-gcm', 'decode', sealed.bytes, { passphrase: 'hunter2' })
    expect(new TextDecoder().decode(opened.bytes)).toBe('secret message')
  })

  it('aes-gcm rejects the wrong passphrase', async () => {
    const sealed = await run('aes-gcm', 'encode', 'secret', {
      keyMode: 'passphrase',
      passphrase: 'right',
      iterations: '1000',
    })
    await expect(
      run('aes-gcm', 'decode', sealed.bytes, { passphrase: 'wrong' }),
    ).rejects.toBeInstanceOf(ToolError)
  })

  it('preserves the original filename in the header', async () => {
    const toolDef = tool('aes-gcm')
    const sealed = await toolDef.run({
      direction: 'encode',
      input: utf8('data'),
      text: 'data',
      params: { keyMode: 'hex', keyHex: KEY_HEX },
      fileName: 'report.pdf',
      mime: 'application/pdf',
    })
    expect(sealed.filename).toBe('report.pdf.clab')
    const opened = await toolDef.run({
      direction: 'decode',
      input: sealed.bytes,
      text: '',
      params: { keyMode: 'hex', keyHex: KEY_HEX },
    })
    expect(opened.filename).toBe('report.pdf')
    expect(opened.mime).toBe('application/pdf')
  })

  it('rejects empty input', async () => {
    await expect(
      run('aes-gcm', 'encode', new Uint8Array(), { keyMode: 'hex', keyHex: KEY_HEX }),
    ).rejects.toBeInstanceOf(ToolError)
  })
})

describe('compression', () => {
  for (const id of ['gzip', 'deflate', 'brotli']) {
    it(`${id} round-trips`, async () => {
      const text = 'compress me '.repeat(40)
      const packed = await run(id, 'encode', text)
      expect(packed.bytes.length).toBeLessThan(utf8(text).length)
      const unpacked = await run(id, 'decode', packed.bytes)
      expect(new TextDecoder().decode(unpacked.bytes)).toBe(text)
    })
  }
})

describe('asymmetric tools', () => {
  it('generates an Ed25519 key pair and signs/verifies', async () => {
    const keypair = await run('keygen', 'encode', '', { type: 'ed25519' })
    const [publicKey, privateKey] = keypair.text!.split('\n\n')

    const sig = await run('ed25519', 'encode', 'signed payload', { privateKey })
    expect(sig.text).toBeTruthy()

    const ok = await run('ed25519', 'decode', 'signed payload', {
      publicKey,
      signature: sig.text!,
      sigFormat: 'base64',
    })
    expect(ok.status).toBe('valid')

    const bad = await run('ed25519', 'decode', 'tampered payload', {
      publicKey,
      signature: sig.text!,
      sigFormat: 'base64',
    })
    expect(bad.status).toBe('invalid')
  })

  it('signs with ECDSA P-256', async () => {
    const keypair = await run('keygen', 'encode', '', { type: 'ecdsa-p256' })
    const [publicKey, privateKey] = keypair.text!.split('\n\n')
    const sig = await run('ecdsa', 'encode', 'hello', { privateKey })
    const ok = await run('ecdsa', 'decode', 'hello', { publicKey, signature: sig.text! })
    expect(ok.status).toBe('valid')
  })

  it('encrypts and decrypts with RSA-OAEP hybrid', async () => {
    const keypair = await run('keygen', 'encode', '', { type: 'rsa-oaep-2048' })
    const [publicKey, privateKey] = keypair.text!.split('\n\n')

    const sealed = await run('rsa-oaep', 'encode', 'rsa payload', { publicKey })
    const opened = await run('rsa-oaep', 'decode', sealed.bytes, { privateKey })
    expect(new TextDecoder().decode(opened.bytes)).toBe('rsa payload')
  }, 30_000)

  it('encrypts and decrypts with ECIES (ECDH P-256)', async () => {
    const keypair = await run('keygen', 'encode', '', { type: 'ecdh-p256' })
    const [publicKey, privateKey] = keypair.text!.split('\n\n')

    const sealed = await run('ecdh-encrypt', 'encode', 'ecies payload', { publicKey })
    const opened = await run('ecdh-encrypt', 'decode', sealed.bytes, { privateKey })
    expect(new TextDecoder().decode(opened.bytes)).toBe('ecies payload')
  })

  it('derives the same ECDH shared secret on both sides', async () => {
    const a = await run('keygen', 'encode', '', { type: 'ecdh-p256' })
    const b = await run('keygen', 'encode', '', { type: 'ecdh-p256' })
    const [aPub, aPriv] = a.text!.split('\n\n')
    const [bPub, bPriv] = b.text!.split('\n\n')

    const fromA = await run('ecdh-shared', 'encode', '', { privateKey: aPriv, publicKey: bPub })
    const fromB = await run('ecdh-shared', 'encode', '', { privateKey: bPriv, publicKey: aPub })
    expect(fromA.text).toBe(fromB.text)
  })
})

describe('key generation', () => {
  it('random generator produces several UUIDs', async () => {
    const out = await run('random', 'encode', '', { mode: 'uuid', count: '3' })
    const lines = out.text!.split('\n').filter(Boolean)
    expect(lines).toHaveLength(3)
    for (const line of lines) {
      expect(line).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
  })

  it('random bytes are hex encoded', async () => {
    const out = await run('random', 'encode', '', { mode: 'bytes', length: '16' })
    expect(out.text).toMatch(/^[0-9a-f]{32}$/)
  })

  it('random passwords honour the requested length', async () => {
    const out = await run('random', 'encode', '', { mode: 'password', length: '40' })
    expect(out.text).toHaveLength(40)
  })
})
