import {
  base32Decode,
  base32Encode,
  base58Decode,
  base58Encode,
  base62Decode,
  base62Encode,
  base85Decode,
  base85Encode,
  binaryDecode,
  binaryEncode,
  decimalDecode,
  decimalEncode,
  octalDecode,
  octalEncode,
} from '../bases'
import {
  bytesToBase64,
  bytesToBase64Url,
  fromBase64,
  fromBase64Url,
  fromHex,
  toHex,
  tryUtf8,
  utf8,
} from '../bytes'
import { fail } from '../errors'
import type { Tool, ToolOutput } from '../types'

function outText(text: string): ToolOutput {
  return { bytes: utf8(text), text }
}

type BytesEncoder = (bytes: Uint8Array) => string
type BytesDecoder = (text: string) => Uint8Array

function byteCodec(id: string, name: string, encode: BytesEncoder, decode: BytesDecoder): Tool {
  return {
    id,
    name,
    category: 'encoding',
    action: 'encode',
    reversible: true,
    run: ({ direction, input }) => {
      if (direction === 'encode') return outText(encode(input))
      const text = tryUtf8(input)
      if (text === null) fail('not_text')
      return { bytes: decode(text) }
    },
  }
}

function textCodec(
  id: string,
  name: string,
  encode: (text: string) => string,
  decode: (text: string) => string,
  extra: Partial<Tool> = {},
): Tool {
  return {
    id,
    name,
    category: 'encoding',
    action: 'encode',
    reversible: true,
    accepts: 'text',
    run: ({ direction, input }) => {
      const text = tryUtf8(input)
      if (text === null) fail('not_text')
      return outText(direction === 'encode' ? encode(text) : decode(text))
    },
    ...extra,
  }
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '\u00a9',
  reg: '\u00ae',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
}

function htmlEncode(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlDecode(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match
  })
}

function unicodeEncode(text: string): string {
  let out = ''
  for (const char of text) {
    const cp = char.codePointAt(0)!
    if (cp > 0xffff) {
      const high = 0xd800 + ((cp - 0x10000) >> 10)
      const low = 0xdc00 + ((cp - 0x10000) & 0x3ff)
      out += `\\u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`
    } else {
      out += `\\u${cp.toString(16).padStart(4, '0')}`
    }
  }
  return out
}

function unicodeDecode(text: string): string {
  return text.replace(
    /\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g,
    (match, braced: string | undefined, four: string | undefined, two: string | undefined) => {
      const hex = braced ?? four ?? two ?? ''
      const code = Number.parseInt(hex, 16)
      if (!Number.isFinite(code) || code > 0x10ffff) fail('invalid_params', match)
      return String.fromCodePoint(code)
    },
  )
}

function a1z26Encode(text: string): string {
  return text
    .toUpperCase()
    .split(/\s+/)
    .map((word) =>
      Array.from(word)
        .filter((c) => c >= 'A' && c <= 'Z')
        .map((c) => String(c.charCodeAt(0) - 64))
        .join('-'),
    )
    .filter((word) => word.length > 0)
    .join(' ')
}

function a1z26Decode(text: string): string {
  return text
    .trim()
    .split(/[\s,;|]+/)
    .filter(Boolean)
    .map((group) =>
      group
        .split('-')
        .map((part) => {
          const n = Number.parseInt(part, 10)
          if (!Number.isFinite(n) || n < 1 || n > 26) fail('invalid_params', part)
          return String.fromCharCode(64 + n)
        })
        .join(''),
    )
    .join(' ')
}

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--',
  '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-',
  _: '..--.-', '"': '.-..-.', $: '...-..-', '@': '.--.-.',
}

const MORSE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE).map(([key, value]) => [value, key]),
)

function morseEncode(text: string): string {
  return text
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      Array.from(word)
        .map((char) => MORSE[char] ?? '?')
        .join(' '),
    )
    .join(' / ')
}

function morseDecode(text: string): string {
  return text
    .trim()
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .split(/\s+/)
        .filter(Boolean)
        .map((code) => MORSE_REVERSE[code] ?? '?')
        .join(''),
    )
    .join(' ')
}

function baconEncode(text: string): string {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '')
  return Array.from(letters)
    .map((char) =>
      (char.charCodeAt(0) - 65).toString(2).padStart(5, '0').replace(/0/g, 'A').replace(/1/g, 'B'),
    )
    .join(' ')
}

function baconDecode(text: string): string {
  const clean = text
    .toUpperCase()
    .replace(/[^AB01]/g, '')
    .replace(/0/g, 'A')
    .replace(/1/g, 'B')
  if (clean.length === 0 || clean.length % 5 !== 0) fail('invalid_params')
  let out = ''
  for (let i = 0; i < clean.length; i += 5) {
    const index = Number.parseInt(clean.slice(i, i + 5).replace(/A/g, '0').replace(/B/g, '1'), 2)
    out += String.fromCharCode(65 + index)
  }
  return out
}

export const encodingTools: Tool[] = [
  byteCodec('base64', 'Base64', bytesToBase64, fromBase64),
  byteCodec('base64url', 'Base64 URL', bytesToBase64Url, fromBase64Url),
  byteCodec('base32', 'Base32 (RFC 4648)', base32Encode, base32Decode),
  byteCodec('base58', 'Base58 (Bitcoin)', base58Encode, base58Decode),
  byteCodec('base62', 'Base62', base62Encode, base62Decode),
  byteCodec('base85', 'Ascii85 (Base85)', base85Encode, base85Decode),
  byteCodec('hex', 'Hexadecimal', (bytes) => toHex(bytes), fromHex),
  byteCodec('binary', 'Binari (8 bits)', binaryEncode, binaryDecode),
  byteCodec('octal', 'Octal', octalEncode, octalDecode),
  byteCodec('decimal', 'Decimal', decimalEncode, decimalDecode),
  textCodec('url', 'URL (percent-encoding)', encodeURIComponent, (text) => {
    try {
      return decodeURIComponent(text.replace(/\+/g, ' '))
    } catch {
      fail('invalid_params')
    }
  }),
  textCodec('html', 'Entitats HTML', htmlEncode, htmlDecode),
  textCodec('unicode', 'Escapat Unicode (\\uXXXX)', unicodeEncode, unicodeDecode),
  textCodec('a1z26', 'A1Z26', a1z26Encode, a1z26Decode),
  textCodec('morse', 'Codi Morse', morseEncode, morseDecode),
  textCodec('bacon', 'Xifrat Bacon', baconEncode, baconDecode),
]
