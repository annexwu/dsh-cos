export interface CiRawResponse {
  ok?: boolean
  status?: number
  timedOut?: boolean
  errorCode?: string
  errorMessage?: string
  requestId?: string | null
  traceId?: string | null
  body?: string
  bodySnippet?: string
}

export interface ParsedCiError {
  code?: string | null
  message?: string | null
  requestId?: string | null
  traceId?: string | null
  resource?: string | null
  details?: unknown
}

export interface RuntimeCredentials {
  secretId: string
  secretKey: string
  token?: string
}

export function cosRequest(options: {
  method: string
  host: string
  pathname?: string
  query?: Record<string, unknown>
  creds: RuntimeCredentials
  body?: string | null
  extraHeaders?: Record<string, string>
  timeoutMs?: number
}): Promise<CiRawResponse & {
  host: string
  method: string
  pathname: string
  query: Record<string, unknown>
}>

export function parseCiRawError(raw: CiRawResponse): ParsedCiError
