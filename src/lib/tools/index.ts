import type { Category, Tool } from '../types'
import { asymmetricTools } from './asymmetric'
import { classicalTools } from './classical'
import { compressionTools } from './compression'
import { encodingTools } from './encodings'
import { hashTools } from './hashes'
import { kdfTools } from './keys'
import { symmetricTools } from './symmetric'

export const ALL_TOOLS: Tool[] = [
  ...symmetricTools,
  ...asymmetricTools,
  ...hashTools,
  ...encodingTools,
  ...classicalTools,
  ...kdfTools,
  ...compressionTools,
]

export const TOOL_MAP = new Map<string, Tool>(ALL_TOOLS.map((tool) => [tool.id, tool]))

export const DEFAULT_TOOL_ID = 'aes-gcm'

export function toolsByCategory(category: Category): Tool[] {
  return ALL_TOOLS.filter((tool) => tool.category === category)
}

export function defaultParams(tool: Tool): Record<string, string> {
  const params: Record<string, string> = {}
  for (const def of tool.params ?? []) params[def.id] = def.default ?? ''
  return params
}
