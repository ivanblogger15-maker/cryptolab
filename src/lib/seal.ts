import { concatBytes, fromUtf8, readUint32BE, uint32BE, utf8 } from './bytes'
import { fail } from './errors'
import type { KdfSpec } from './kdf'

const MAGIC = 'CLAB'
const VERSION = 1

/**
 * Header stored in front of encrypted payloads produced by CryptoLab.
 * All binary fields are base64 encoded so the header stays valid JSON.
 */
export interface SealHeader {
  v: number
  algo: string
  name?: string
  mime?: string
  createdAt?: string
  iv?: string
  kdf?: KdfSpec
  wrappedKey?: string
  epk?: string
  extra?: Record<string, string | number | boolean>
}

export function seal(header: SealHeader, payload: Uint8Array): Uint8Array {
  const json = utf8(JSON.stringify({ ...header, v: VERSION }))
  return concatBytes(utf8(MAGIC), new Uint8Array([VERSION]), uint32BE(json.length), json, payload)
}

export function unseal(bytes: Uint8Array): { header: SealHeader; payload: Uint8Array } | null {
  if (bytes.length < 9) return null
  if (fromUtf8(bytes.subarray(0, 4)) !== MAGIC) return null
  if (bytes[4] !== VERSION) fail('unsupported')
  const headerLength = readUint32BE(bytes, 5)
  if (headerLength === 0 || headerLength > bytes.length - 9) fail('invalid_params')
  let header: SealHeader
  try {
    header = JSON.parse(fromUtf8(bytes.subarray(9, 9 + headerLength))) as SealHeader
  } catch {
    fail('invalid_params')
  }
  if (!header.algo) fail('invalid_params')
  return { header, payload: bytes.subarray(9 + headerLength) }
}

export function isSealed(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && fromUtf8(bytes.subarray(0, 4)) === MAGIC
}
