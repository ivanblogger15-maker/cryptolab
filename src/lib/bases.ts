import { fail } from './errors'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    value &= (1 << bits) - 1
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  while (out.length % 8 !== 0) out += '='
  return out
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')
  if (clean.length % 8 === 1 || clean.length % 8 === 3 || clean.length % 8 === 6) fail('invalid_params')
  if (!/^[A-Z2-7]*$/.test(clean)) fail('invalid_params')
  const out: number[] = []
  let bits = 0
  let value = 0
  for (const char of clean) {
    const index = B32.indexOf(char)
    if (index < 0) fail('invalid_params')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
    value &= (1 << bits) - 1
  }
  return new Uint8Array(out)
}

function encodeBaseX(bytes: Uint8Array, alphabet: string, maxLength = 512 * 1024): string {
  if (bytes.length > maxLength) fail('too_large')
  const base = alphabet.length
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++
  const digits: number[] = []
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8
      digits[j] = carry % base
      carry = (carry / base) | 0
    }
    while (carry > 0) {
      digits.push(carry % base)
      carry = (carry / base) | 0
    }
  }
  let out = alphabet[0].repeat(zeros)
  for (let i = digits.length - 1; i >= 0; i--) out += alphabet[digits[i]]
  return out || ''
}

function decodeBaseX(input: string, alphabet: string, maxLength = 512 * 1024): Uint8Array {
  const clean = input.replace(/\s/g, '')
  if (clean.length > maxLength) fail('too_large')
  const base = alphabet.length
  let zeros = 0
  while (zeros < clean.length && clean[zeros] === alphabet[0]) zeros++
  const bytes: number[] = []
  for (let i = zeros; i < clean.length; i++) {
    const value = alphabet.indexOf(clean[i])
    if (value < 0) fail('invalid_params', clean[i])
    let carry = value
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * base
      bytes[j] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  const out = new Uint8Array(zeros + bytes.length)
  for (let i = 0; i < bytes.length; i++) out[out.length - 1 - i] = bytes[i]
  return out
}

export function base58Encode(bytes: Uint8Array): string {
  return encodeBaseX(bytes, B58)
}

export function base58Decode(input: string): Uint8Array {
  return decodeBaseX(input, B58)
}

export function base62Encode(bytes: Uint8Array): string {
  return encodeBaseX(bytes, B62)
}

export function base62Decode(input: string): Uint8Array {
  return decodeBaseX(input, B62)
}

/** Ascii85 (Adobe flavour), including the `z` shorthand for four zero bytes. */
export function base85Encode(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 4 <= bytes.length; i += 4) {
    const n = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0
    if (n === 0) {
      out += 'z'
      continue
    }
    const block = new Array<string>(5)
    let value = n
    for (let j = 4; j >= 0; j--) {
      block[j] = String.fromCharCode(33 + (value % 85))
      value = Math.floor(value / 85)
    }
    out += block.join('')
  }
  const rest = bytes.length - i
  if (rest > 0) {
    const chunk = new Uint8Array(4)
    chunk.set(bytes.subarray(i))
    const n = ((chunk[0] << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3]) >>> 0
    const block = new Array<string>(5)
    let value = n
    for (let j = 4; j >= 0; j--) {
      block[j] = String.fromCharCode(33 + (value % 85))
      value = Math.floor(value / 85)
    }
    out += block.slice(0, rest + 1).join('')
  }
  return out
}

export function base85Decode(input: string): Uint8Array {
  let clean = input.replace(/\s/g, '')
  if (clean.startsWith('<~')) clean = clean.slice(2)
  if (clean.endsWith('~>')) clean = clean.slice(0, -2)
  const out: number[] = []
  let group: number[] = []
  const flush = (count: number) => {
    let n = 0
    for (const c of group) n = n * 85 + c
    const bytes = [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
    out.push(...bytes.slice(0, count))
    group = []
  }
  for (const char of clean) {
    if (char === 'z' && group.length === 0) {
      out.push(0, 0, 0, 0)
      continue
    }
    const code = char.charCodeAt(0) - 33
    if (code < 0 || code > 84) fail('invalid_params', char)
    group.push(code)
    if (group.length === 5) flush(4)
  }
  if (group.length > 0) {
    if (group.length === 1) fail('invalid_params')
    const count = group.length - 1
    while (group.length < 5) group.push(84)
    flush(count)
  }
  return new Uint8Array(out)
}

export function binaryEncode(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join(' ')
}

export function binaryDecode(input: string): Uint8Array {
  const parts = input.trim().split(/[\s,;]+/).filter(Boolean)
  if (parts.length === 0) return new Uint8Array(0)
  for (const part of parts) {
    if (!/^[01]{1,8}$/.test(part)) fail('invalid_params', part)
  }
  return new Uint8Array(parts.map((p) => Number.parseInt(p, 2)))
}

export function octalEncode(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(8).padStart(3, '0')).join(' ')
}

export function octalDecode(input: string): Uint8Array {
  const parts = input.trim().split(/[\s,;]+/).filter(Boolean)
  if (parts.length === 0) return new Uint8Array(0)
  for (const part of parts) {
    if (!/^[0-7]{1,3}$/.test(part)) fail('invalid_params', part)
  }
  return new Uint8Array(parts.map((p) => Number.parseInt(p, 8)))
}

export function decimalEncode(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(10).padStart(3, '0')).join(' ')
}

export function decimalDecode(input: string): Uint8Array {
  const parts = input.trim().split(/[\s,;]+/).filter(Boolean)
  if (parts.length === 0) return new Uint8Array(0)
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) fail('invalid_params', part)
  }
  return new Uint8Array(parts.map((p) => Number.parseInt(p, 10)))
}
