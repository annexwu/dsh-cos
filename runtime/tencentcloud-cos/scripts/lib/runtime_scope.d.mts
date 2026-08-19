export interface RuntimeScope {
  bucket?: string
  region?: string
  datasetName?: string
  appId?: string
}

export function resolveRuntimeScope(
  options?: Record<string, unknown>,
  env?: Record<string, string | undefined>,
): RuntimeScope

export function requireRuntimeAppId(scope: RuntimeScope): string
export function requireRuntimeRegion(scope: RuntimeScope): string
export function resolveMetaInsightHost(scope: RuntimeScope): string

export function resolveDatasetName(
  options?: Record<string, unknown>,
  fallback?: string,
  settings?: { allowName?: boolean },
): string | undefined
