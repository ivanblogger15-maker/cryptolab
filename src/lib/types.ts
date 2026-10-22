export type Lang = 'ca' | 'es' | 'en'

export type Category =
  | 'encoding'
  | 'classical'
  | 'hash'
  | 'symmetric'
  | 'asymmetric'
  | 'compression'
  | 'kdf'

export type Direction = 'encode' | 'decode'

export type InputMode = 'text' | 'file'

export type ParamType = 'text' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox'

export type Params = Record<string, string>

export interface ParamOption {
  value: string
  /** Literal label (technical names are not translated). */
  label: string
}

export interface ParamDef {
  id: string
  /** i18n key. */
  label: string
  type: ParamType
  default?: string
  placeholder?: string
  /** i18n key shown under the field. */
  help?: string
  options?: ParamOption[]
  min?: number
  max?: number
  step?: number
  width?: 'full' | 'half'
  required?: boolean
  mono?: boolean
  showIf?: (params: Params, direction: Direction) => boolean
}

export interface RunContext {
  direction: Direction
  input: Uint8Array
  /** UTF-8 decoding of the input, or an empty string for binary data. */
  text: string
  params: Params
  fileName?: string
  mime?: string
}

export interface OutputBlock {
  label: string
  text: string
  filename?: string
  hint?: string
}

export interface OutputMeta {
  label: string
  value: string
  mono?: boolean
}

export interface ToolOutput {
  bytes: Uint8Array
  /** Preferred textual representation. */
  text?: string
  filename?: string
  mime?: string
  blocks?: OutputBlock[]
  metas?: OutputMeta[]
  status?: 'valid' | 'invalid'
  /** i18n keys rendered as informational notes. */
  noteKeys?: string[]
}

export type ActionKind = 'encode' | 'encrypt' | 'hash' | 'sign' | 'generate' | 'compress'

export interface Tool {
  id: string
  name: string
  category: Category
  action: ActionKind
  /** Whether encode/decode is offered. */
  reversible?: boolean
  /** What kind of input the tool understands. Defaults to 'both'. */
  accepts?: 'text' | 'bytes' | 'both'
  /** Set to false to hide the file tab. */
  fileSupport?: boolean
  /** Tools without input (key generation, random data). */
  noInput?: boolean
  params?: ParamDef[]
  badge?: 'recommended' | 'legacy' | 'insecure'
  run: (ctx: RunContext) => Promise<ToolOutput> | ToolOutput
}
