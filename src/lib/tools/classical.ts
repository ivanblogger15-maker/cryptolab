import { fromHex, tryUtf8, utf8 } from '../bytes'
import { fail } from '../errors'
import type { ParamDef, Tool, ToolOutput } from '../types'

function textOut(text: string): ToolOutput {
  return { bytes: utf8(text), text }
}

function requireText(input: Uint8Array): string {
  const text = tryUtf8(input)
  if (text === null) fail('not_text')
  return text
}

function mapLetters(text: string, fn: (char: string, index: number) => string): string {
  return Array.from(text)
    .map((char) => (/[a-z]/i.test(char) ? fn(char, 0) : char))
    .join('')
}

function shiftLetter(char: string, shift: number): string {
  const base = char >= 'a' && char <= 'z' ? 97 : 65
  const code = char.charCodeAt(0) - base
  return String.fromCharCode(base + ((((code + shift) % 26) + 26) % 26))
}

function caesarShift(text: string, shift: number): string {
  return mapLetters(text, (char) => shiftLetter(char, shift))
}

function vigenere(text: string, key: string, decode: boolean): string {
  const cleanKey = Array.from(key.toUpperCase()).filter((c) => c >= 'A' && c <= 'Z')
  if (cleanKey.length === 0) fail('invalid_params', 'key')
  let keyIndex = 0
  let out = ''
  for (const char of text) {
    if (/[a-z]/i.test(char)) {
      const shift = cleanKey[keyIndex % cleanKey.length].charCodeAt(0) - 65
      out += shiftLetter(char, decode ? -shift : shift)
      keyIndex++
    } else {
      out += char
    }
  }
  return out
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b]
  return a
}

function modInverse(a: number, m: number): number {
  for (let x = 1; x < m; x++) if ((a * x) % m === 1) return x
  fail('invalid_params', 'a')
}

function affine(text: string, a: number, b: number, decode: boolean): string {
  if (gcd(a, 26) !== 1) fail('invalid_params', 'a')
  const inverse = decode ? modInverse(a, 26) : a
  return mapLetters(text, (char) => {
    const x = char.toUpperCase().charCodeAt(0) - 65
    const y = decode ? (((inverse * (x - b)) % 26) + 26) % 26 : (a * x + b) % 26
    const base = char >= 'a' && char <= 'z' ? 97 : 65
    return String.fromCharCode(base + y)
  })
}

function playfairSquare(key: string): string {
  const seen = new Set<string>()
  let square = ''
  for (const char of `${key}ABCDEFGHIKLMNOPQRSTUVWXYZ`.toUpperCase()) {
    if (char < 'A' || char > 'Z' || char === 'J') continue
    if (!seen.has(char)) {
      seen.add(char)
      square += char
    }
  }
  return square
}

function playfair(text: string, key: string, decode: boolean): string {
  const square = playfairSquare(key)
  if (square.length !== 25) fail('invalid_params', 'key')
  const pos = (char: string) => {
    const index = square.indexOf(char)
    return { row: Math.floor(index / 5), col: index % 5 }
  }
  const at = (row: number, col: number) => square[((row + 5) % 5) * 5 + ((col + 5) % 5)]

  const letters = Array.from(text.toUpperCase()).filter((c) => c >= 'A' && c <= 'Z')
  const prepared: string[] = []
  for (let i = 0; i < letters.length; i++) {
    const char = letters[i] === 'J' ? 'I' : letters[i]
    prepared.push(char)
    if (letters[i + 1] === char) {
      prepared.push('X')
    }
  }
  if (prepared.length % 2 !== 0) prepared.push('X')

  let out = ''
  for (let i = 0; i < prepared.length; i += 2) {
    const a = prepared[i]
    const b = prepared[i + 1]
    const pa = pos(a)
    const pb = pos(b)
    const delta = decode ? 4 : 1
    if (pa.row === pb.row) {
      out += at(pa.row, pa.col + delta) + at(pb.row, pb.col + delta)
    } else if (pa.col === pb.col) {
      out += at(pa.row + delta, pa.col) + at(pb.row + delta, pb.col)
    } else {
      out += at(pa.row, pb.col) + at(pb.row, pa.col)
    }
  }
  return decode ? out.replace(/X$/, '') : out
}

function railPattern(length: number, rails: number): number[] {
  const pattern: number[] = []
  let rail = 0
  let direction = 1
  for (let i = 0; i < length; i++) {
    pattern.push(rail)
    if (rail === 0) direction = 1
    else if (rail === rails - 1) direction = -1
    rail += direction
  }
  return pattern
}

function railFence(text: string, rails: number, decode: boolean): string {
  const chars = Array.from(text)
  if (chars.length === 0) return ''
  const pattern = railPattern(chars.length, rails)
  if (!decode) {
    let out = ''
    for (let r = 0; r < rails; r++) {
      for (let i = 0; i < chars.length; i++) if (pattern[i] === r) out += chars[i]
    }
    return out
  }
  const counts = new Array<number>(rails).fill(0)
  for (const rail of pattern) counts[rail]++
  const rows: string[][] = []
  let offset = 0
  for (let r = 0; r < rails; r++) {
    rows.push(chars.slice(offset, offset + counts[r]))
    offset += counts[r]
  }
  const indexes = new Array<number>(rails).fill(0)
  return pattern.map((rail) => rows[rail][indexes[rail]++]).join('')
}

function columnar(text: string, key: string, decode: boolean): string {
  const cleanKey = Array.from(key.toUpperCase()).filter((c) => c >= 'A' && c <= 'Z')
  if (cleanKey.length < 2) fail('invalid_params', 'key')
  const columns = cleanKey.length
  const order = cleanKey
    .map((char, index) => ({ char, index }))
    .sort((a, b) => (a.char < b.char ? -1 : a.char > b.char ? 1 : a.index - b.index))
    .map((entry) => entry.index)

  const padded = text.padEnd(Math.ceil(text.length / columns) * columns, 'X')
  const rows = padded.length / columns

  if (!decode) {
    let out = ''
    for (const col of order) {
      for (let row = 0; row < rows; row++) out += padded[row * columns + col]
    }
    return out
  }

  const grid = new Array<string>(padded.length)
  let offset = 0
  for (const col of order) {
    for (let row = 0; row < rows; row++) {
      grid[row * columns + col] = padded[offset++]
    }
  }
  return decode ? grid.join('').replace(/X$/, '') : grid.join('')
}

function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (key.length === 0) fail('invalid_params', 'key')
  const out = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length]
  return out
}

function keyFromParams(params: Record<string, string>, requireHex: boolean): Uint8Array {
  if (requireHex) {
    const key = fromHex(params.key ?? '')
    if (key.length === 0) fail('invalid_params', 'key')
    return key
  }
  const format = params.keyFormat ?? 'text'
  const key = format === 'hex' ? fromHex(params.key ?? '') : utf8(params.key ?? '')
  if (key.length === 0) fail('invalid_params', 'key')
  return key
}

const shiftParam: ParamDef = {
  id: 'shift',
  label: 'p.shift',
  type: 'number',
  default: '3',
  min: 0,
  max: 25,
  width: 'half',
}

export const classicalTools: Tool[] = [
  {
    id: 'caesar',
    name: 'Cèsar',
    category: 'classical',
    action: 'encode',
    reversible: true,
    params: [
      shiftParam,
      {
        id: 'brute',
        label: 'p.bruteForce',
        type: 'checkbox',
        default: 'false',
        width: 'half',
        showIf: (_params, direction) => direction === 'decode',
      },
    ],
    run: ({ direction, input, params }) => {
      const text = requireText(input)
      const shift = Number.parseInt(params.shift ?? '3', 10) || 0
      if (direction === 'decode' && params.brute === 'true') {
        const lines = Array.from({ length: 26 }, (_, i) => {
          const candidate = caesarShift(text, -i)
          return `ROT ${i.toString().padStart(2, '0')}: ${candidate}`
        })
        return textOut(lines.join('\n'))
      }
      return textOut(caesarShift(text, direction === 'encode' ? shift : -shift))
    },
  },
  {
    id: 'rot13',
    name: 'ROT13',
    category: 'classical',
    action: 'encode',
    reversible: true,
    run: ({ input }) => textOut(caesarShift(requireText(input), 13)),
  },
  {
    id: 'rot47',
    name: 'ROT47',
    category: 'classical',
    action: 'encode',
    reversible: true,
    run: ({ input }) => {
      const text = requireText(input)
      return textOut(
        Array.from(text)
          .map((char) => {
            const code = char.charCodeAt(0)
            return code >= 33 && code <= 126 ? String.fromCharCode(33 + ((code - 33 + 47) % 94)) : char
          })
          .join(''),
      )
    },
  },
  {
    id: 'atbash',
    name: 'Atbash',
    category: 'classical',
    action: 'encode',
    reversible: true,
    run: ({ input }) =>
      textOut(
        mapLetters(requireText(input), (char) => {
          const base = char >= 'a' && char <= 'z' ? 97 : 65
          return String.fromCharCode(base + (25 - (char.charCodeAt(0) - base)))
        }),
      ),
  },
  {
    id: 'vigenere',
    name: 'Vigenère',
    category: 'classical',
    action: 'encode',
    reversible: true,
    params: [{ id: 'key', label: 'p.key', type: 'text', placeholder: 'CLAU', required: true }],
    run: ({ direction, input, params }) =>
      textOut(vigenere(requireText(input), params.key ?? '', direction === 'decode')),
  },
  {
    id: 'affine',
    name: 'Afí (Affine)',
    category: 'classical',
    action: 'encode',
    reversible: true,
    params: [
      { id: 'a', label: 'p.affineA', type: 'number', default: '5', min: 1, max: 25, width: 'half' },
      { id: 'b', label: 'p.affineB', type: 'number', default: '8', min: 0, max: 25, width: 'half' },
    ],
    run: ({ direction, input, params }) =>
      textOut(
        affine(
          requireText(input),
          Number.parseInt(params.a ?? '5', 10),
          Number.parseInt(params.b ?? '8', 10),
          direction === 'decode',
        ),
      ),
  },
  {
    id: 'playfair',
    name: 'Playfair',
    category: 'classical',
    action: 'encode',
    reversible: true,
    accepts: 'text',
    params: [{ id: 'key', label: 'p.keyword', type: 'text', placeholder: 'MONARQUIA', required: true }],
    run: ({ direction, input, params }) => {
      const text = playfair(requireText(input), params.key ?? '', direction === 'decode')
      return {
        bytes: utf8(text),
        text,
        noteKeys: direction === 'decode' ? ['note.paddingX'] : undefined,
      }
    },
  },
  {
    id: 'railfence',
    name: 'Rail Fence',
    category: 'classical',
    action: 'encode',
    reversible: true,
    params: [
      { id: 'rails', label: 'p.rails', type: 'number', default: '3', min: 2, max: 20, width: 'half' },
    ],
    run: ({ direction, input, params }) =>
      textOut(
        railFence(
          requireText(input),
          Math.max(2, Number.parseInt(params.rails ?? '3', 10)),
          direction === 'decode',
        ),
      ),
  },
  {
    id: 'columnar',
    name: 'Transposició columnar',
    category: 'classical',
    action: 'encode',
    reversible: true,
    params: [{ id: 'key', label: 'p.keyword', type: 'text', placeholder: 'CRIPTO', required: true }],
    run: ({ direction, input, params }) => {
      const text = columnar(requireText(input), params.key ?? '', direction === 'decode')
      return {
        bytes: utf8(text),
        text,
        noteKeys: direction === 'decode' ? ['note.paddingX'] : undefined,
      }
    },
  },
  {
    id: 'xor',
    name: 'XOR',
    category: 'classical',
    action: 'encode',
    reversible: true,
    params: [
      { id: 'key', label: 'p.key', type: 'text', placeholder: 'la meva clau', required: true },
      {
        id: 'keyFormat',
        label: 'p.keyFormat',
        type: 'select',
        default: 'text',
        width: 'half',
        options: [
          { value: 'text', label: 'opt.text' },
          { value: 'hex', label: 'opt.hex' },
        ],
      },
    ],
    badge: 'insecure',
    run: ({ input, params }) => ({ bytes: xorBytes(input, keyFromParams(params, false)) }),
  },
  {
    id: 'otp',
    name: 'One-Time Pad',
    category: 'classical',
    action: 'encode',
    reversible: true,
    params: [
      {
        id: 'key',
        label: 'p.otpKey',
        type: 'textarea',
        placeholder: 'hex, igual de llarg que el missatge',
        required: true,
        mono: true,
      },
    ],
    badge: 'recommended',
    run: ({ input, params }) => {
      const key = fromHex(params.key ?? '')
      if (key.length < input.length) fail('invalid_params', 'key too short')
      return { bytes: xorBytes(input, key.slice(0, input.length)) }
    },
  },
]
