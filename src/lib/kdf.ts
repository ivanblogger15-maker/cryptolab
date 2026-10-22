import { bytesToBase64, fromBase64, utf8 } from './bytes'
import { fail } from './errors'
import { ab } from './webcrypto'

export type KdfId = 'pbkdf2' | 'scrypt' | 'argon2id'

export interface KdfSpec {
  id: KdfId
  salt: string
  iterations?: number
  n?: number
  memory?: number
}

export const DEFAULT_ITERATIONS = 600_000
export const DEFAULT_SCRYPT_N = 16_384
export const DEFAULT_ARGON_MEMORY = 65_536

export function makeKdfSpec(id: KdfId, params: Record<string, string>, salt: Uint8Array): KdfSpec {
  const spec: KdfSpec = { id, salt: bytesToBase64(salt) }
  if (id === 'pbkdf2') spec.iterations = clampInt(params.iterations, DEFAULT_ITERATIONS, 1_000, 10_000_000)
  if (id === 'scrypt') spec.n = clampInt(params.scryptN, DEFAULT_SCRYPT_N, 1_024, 1_048_576)
  if (id === 'argon2id') spec.memory = clampInt(params.argonMemory, DEFAULT_ARGON_MEMORY, 8_192, 1_048_576)
  return spec
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

export async function deriveKey(passphrase: string, spec: KdfSpec): Promise<Uint8Array> {
  if (passphrase.length === 0) fail('invalid_params')
  const salt = fromBase64(spec.salt)
  const password = utf8(passphrase)

  switch (spec.id) {
    case 'pbkdf2': {
      const iterations = Math.max(1_000, spec.iterations ?? DEFAULT_ITERATIONS)
      const base = await crypto.subtle.importKey('raw', ab(password), 'PBKDF2', false, ['deriveBits'])
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: ab(salt), iterations },
        base,
        256,
      )
      return new Uint8Array(bits)
    }
    case 'scrypt': {
      const n = Math.max(1_024, spec.n ?? DEFAULT_SCRYPT_N)
      const { scrypt } = await import('hash-wasm')
      const key = await scrypt({
        password,
        salt,
        costFactor: n,
        blockSize: 8,
        parallelism: 1,
        hashLength: 32,
        outputType: 'binary',
      })
      return key
    }
    case 'argon2id': {
      const memory = Math.max(8_192, spec.memory ?? DEFAULT_ARGON_MEMORY)
      const { argon2id } = await import('hash-wasm')
      const key = await argon2id({
        password,
        salt,
        iterations: 3,
        parallelism: 1,
        memorySize: memory,
        hashLength: 32,
        outputType: 'binary',
      })
      return key
    }
    default:
      fail('unsupported')
  }
}

export function kdfLabel(spec: KdfSpec): string {
  switch (spec.id) {
    case 'pbkdf2':
      return `PBKDF2-SHA256 · ${(spec.iterations ?? DEFAULT_ITERATIONS).toLocaleString('en-US')} iter.`
    case 'scrypt':
      return `scrypt · N=${(spec.n ?? DEFAULT_SCRYPT_N).toLocaleString('en-US')}`
    case 'argon2id':
      return `Argon2id · ${((spec.memory ?? DEFAULT_ARGON_MEMORY) / 1024).toFixed(0)} MiB`
  }
}
