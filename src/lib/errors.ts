export type ErrorCode =
  | 'empty_input'
  | 'not_text'
  | 'invalid_base64'
  | 'invalid_hex'
  | 'invalid_params'
  | 'invalid_key_length'
  | 'invalid_key'
  | 'invalid_pem'
  | 'decrypt_failed'
  | 'unsupported'
  | 'too_large'
  | 'no_container'
  | 'invalid_signature'
  | 'invalid_utf8'
  | 'no_input'

export class ToolError extends Error {
  code: ErrorCode
  detail?: string

  constructor(code: ErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'ToolError'
    this.code = code
    this.detail = detail
  }
}

export function fail(code: ErrorCode, detail?: string): never {
  throw new ToolError(code, detail)
}
