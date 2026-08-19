export interface RuntimeRequestSummary {
  method?: string
  host?: string
  pathname?: string
}

export interface NormalizedRuntimeError {
  message: string
  code?: string | number
  statusCode?: string | number
  requestId?: string | number
  traceId?: string | number
  resource?: string | number
  details?: Record<string, unknown>
  request?: RuntimeRequestSummary
}

export function normalizeRuntimeError(error: unknown, context?: RuntimeRequestSummary & { url?: string }): NormalizedRuntimeError
export function runtimeFailurePayload(action: string, error: unknown, context?: RuntimeRequestSummary & { url?: string }): {
  success: false
  action: string
  error: NormalizedRuntimeError
}
