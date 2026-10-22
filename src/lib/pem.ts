import { bytesToBase64, fromBase64 } from './bytes'
import { fail } from './errors'

export function toPem(label: string, der: Uint8Array): string {
  const b64 = bytesToBase64(der)
  const lines = b64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

export function fromPem(input: string): { label: string; der: Uint8Array } {
  const trimmed = input.trim()
  const match = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(trimmed)
  if (match) {
    return { label: match[1], der: fromBase64(match[2]) }
  }
  // Accept bare base64 as a convenience.
  const bare = trimmed.replace(/\s/g, '')
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(bare)) {
    return { label: 'KEY', der: fromBase64(bare) }
  }
  fail('invalid_pem')
}
