import type { ActionKind, Category, Direction, Tool } from '../lib/types'

export const CATEGORY_ORDER: Category[] = [
  'symmetric',
  'asymmetric',
  'hash',
  'encoding',
  'classical',
  'kdf',
  'compression',
]

export const CATEGORY_LABEL: Record<Category, string> = {
  symmetric: 'cat.symmetric',
  asymmetric: 'cat.asymmetric',
  hash: 'cat.hash',
  encoding: 'cat.encoding',
  classical: 'cat.classical',
  kdf: 'cat.kdf',
  compression: 'cat.compression',
}

export function actionKeys(action: ActionKind): [string, string] {
  switch (action) {
    case 'encrypt':
      return ['action.encrypt', 'action.decrypt']
    case 'hash':
      return ['action.hash', 'action.hash']
    case 'sign':
      return ['action.sign', 'action.verify']
    case 'generate':
      return ['action.generate', 'action.generate']
    case 'compress':
      return ['action.compress', 'action.decompress']
    default:
      return ['action.encode', 'action.decode']
  }
}

export function actionLabelKey(tool: Tool, direction: Direction): string {
  const [encodeKey, decodeKey] = actionKeys(tool.action)
  return direction === 'encode' ? encodeKey : decodeKey
}

export function outputFilename(tool: Tool, direction: Direction, current?: string): string {
  const base = tool.id.replace(/[^a-z0-9-]/gi, '-')
  return current ?? `${base}-${direction === 'encode' ? 'output' : 'decoded'}.txt`
}
