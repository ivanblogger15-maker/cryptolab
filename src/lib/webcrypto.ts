import { fromUtf8, utf8 } from './bytes'
import { fail } from './errors'
import { fromPem, toPem } from './pem'

export function ab(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) fail('unsupported', 'WebCrypto')
  return crypto.subtle
}

export async function importAesKey(raw: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  return subtle().importKey('raw', ab(raw), 'AES-GCM', false, usage)
}

export async function aesGcmEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
  aad?: Uint8Array,
): Promise<Uint8Array> {
  const cryptoKey = await importAesKey(key, ['encrypt'])
  const params: AesGcmParams = { name: 'AES-GCM', iv: ab(iv), tagLength: 128 }
  if (aad) params.additionalData = ab(aad)
  return new Uint8Array(await subtle().encrypt(params, cryptoKey, ab(data)))
}

export async function aesGcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
  aad?: Uint8Array,
): Promise<Uint8Array> {
  const cryptoKey = await importAesKey(key, ['decrypt'])
  const params: AesGcmParams = { name: 'AES-GCM', iv: ab(iv), tagLength: 128 }
  if (aad) params.additionalData = ab(aad)
  try {
    return new Uint8Array(await subtle().decrypt(params, cryptoKey, ab(data)))
  } catch {
    fail('decrypt_failed')
  }
}

export async function aesCbcEncrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await subtle().importKey('raw', ab(key), 'AES-CBC', false, ['encrypt'])
  return new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: ab(iv) }, cryptoKey, ab(data)))
}

export async function aesCbcDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await subtle().importKey('raw', ab(key), 'AES-CBC', false, ['decrypt'])
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-CBC', iv: ab(iv) }, cryptoKey, ab(data)))
  } catch {
    fail('decrypt_failed')
  }
}

export async function aesCtrTransform(
  key: Uint8Array,
  counter: Uint8Array,
  data: Uint8Array,
  mode: 'encrypt' | 'decrypt',
): Promise<Uint8Array> {
  const cryptoKey = await subtle().importKey('raw', ab(key), 'AES-CTR', false, [mode])
  const params: AesCtrParams = { name: 'AES-CTR', counter: ab(counter), length: 64 }
  try {
    if (mode === 'encrypt') {
      return new Uint8Array(await subtle().encrypt(params, cryptoKey, ab(data)))
    }
    return new Uint8Array(await subtle().decrypt(params, cryptoKey, ab(data)))
  } catch {
    fail('decrypt_failed')
  }
}

function publicUsages(name: string): KeyUsage[] {
  if (name === 'RSA-OAEP') return ['encrypt']
  if (name === 'RSA-PSS' || name === 'ECDSA' || name === 'Ed25519') return ['verify']
  return []
}

function privateUsages(name: string): KeyUsage[] {
  if (name === 'RSA-OAEP') return ['decrypt']
  if (name === 'ECDH') return ['deriveBits']
  return ['sign']
}

export async function importPublicKey(
  pem: string,
  algorithm: RsaHashedImportParams | EcKeyImportParams | Algorithm,
): Promise<CryptoKey> {
  try {
    const der = fromPem(pem).der
    return await subtle().importKey('spki', ab(der), algorithm, true, publicUsages(algorithm.name))
  } catch {
    fail('invalid_key')
  }
}

export async function importPrivateKey(
  pem: string,
  algorithm: RsaHashedImportParams | EcKeyImportParams | Algorithm,
): Promise<CryptoKey> {
  try {
    const der = fromPem(pem).der
    return await subtle().importKey('pkcs8', ab(der), algorithm, true, privateUsages(algorithm.name))
  } catch {
    fail('invalid_key')
  }
}

export async function exportPublicPem(key: CryptoKey): Promise<string> {
  const der = new Uint8Array(await subtle().exportKey('spki', key))
  return toPem('PUBLIC KEY', der)
}

export async function exportPrivatePem(key: CryptoKey): Promise<string> {
  const der = new Uint8Array(await subtle().exportKey('pkcs8', key))
  return toPem('PRIVATE KEY', der)
}

export function textOf(bytes: Uint8Array): string {
  return fromUtf8(bytes)
}

export function bytesOf(text: string): Uint8Array {
  return utf8(text)
}
