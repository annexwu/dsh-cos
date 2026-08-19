const SENSITIVE_KEY = /(?:authorization|cookie|credential|secret|signature|token|password|private[-_]?key)/i;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '');
}

function scalar(value) {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function headerValue(headers, ...names) {
  if (!isObject(headers)) return undefined;
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return firstDefined(...names.map(name => scalar(normalized[name.toLowerCase()])));
}

function safeRequest(error, context = {}) {
  const rawUrl = scalar(firstDefined(context.url, error?.url, error?.request?.url));
  let host = scalar(firstDefined(context.host, error?.request?.host));
  let pathname = scalar(firstDefined(context.pathname, error?.request?.pathname));
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      host ||= parsed.host;
      pathname ||= parsed.pathname;
    } catch {
      // Ignore malformed SDK URLs rather than exposing the raw value.
    }
  }
  const method = scalar(firstDefined(context.method, error?.method, error?.request?.method));
  const request = { method, host, pathname };
  return Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined));
}

function safeDetailValue(value, depth = 0) {
  const normalized = scalar(value);
  if (normalized !== undefined) return normalized;
  if (depth >= 2) return undefined;
  if (Array.isArray(value)) {
    const items = value.slice(0, 10).map(item => safeDetailValue(item, depth + 1)).filter(item => item !== undefined);
    return items.length > 0 ? items : undefined;
  }
  if (!isObject(value)) return undefined;
  const entries = Object.entries(value)
    .filter(([key]) => !SENSITIVE_KEY.test(key))
    .slice(0, 20)
    .map(([key, child]) => [key, safeDetailValue(child, depth + 1)])
    .filter(([, child]) => child !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function safeDetails(...sources) {
  const details = {};
  for (const source of sources) {
    if (!isObject(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      if (SENSITIVE_KEY.test(key)) continue;
      if (!/^(?:detail|details|reason|type|argumentname|argumentvalue)$/i.test(key)) continue;
      const normalized = safeDetailValue(value);
      if (normalized !== undefined) details[key] = normalized;
    }
  }
  return Object.keys(details).length > 0 ? details : undefined;
}

export function normalizeRuntimeError(error, context = {}) {
  const root = isObject(error) ? error : {};
  const nested = isObject(root.error) ? root.error : {};
  const response = isObject(root.response) ? root.response : {};
  const responseError = isObject(response.error) ? response.error : {};
  const headers = firstDefined(root.headers, response.headers);

  const message = scalar(firstDefined(
    nested.Message,
    nested.message,
    responseError.Message,
    responseError.message,
    root.Message,
    root.message,
    typeof root.error === 'string' ? root.error : undefined,
    typeof error === 'string' ? error : undefined,
  )) || 'Tencent Cloud request failed.';
  const code = scalar(firstDefined(
    nested.Code,
    nested.code,
    responseError.Code,
    responseError.code,
    root.Code,
    root.code,
  ));
  const statusCode = scalar(firstDefined(root.statusCode, root.status, response.statusCode, response.status));
  const requestId = scalar(firstDefined(
    nested.RequestId,
    nested.requestId,
    responseError.RequestId,
    responseError.requestId,
    root.RequestId,
    root.requestId,
    headerValue(headers, 'x-cos-request-id', 'x-cos-req-id'),
  ));
  const traceId = scalar(firstDefined(
    nested.TraceId,
    nested.traceId,
    responseError.TraceId,
    responseError.traceId,
    root.TraceId,
    root.traceId,
    headerValue(headers, 'x-cos-trace-id'),
  ));
  const resource = scalar(firstDefined(
    nested.Resource,
    nested.resource,
    responseError.Resource,
    responseError.resource,
    root.Resource,
    root.resource,
  ));
  const request = safeRequest(root, context);
  const details = safeDetails(nested, responseError, root);

  return Object.fromEntries(Object.entries({
    message,
    code,
    statusCode,
    requestId,
    traceId,
    resource,
    details,
    request: Object.keys(request).length > 0 ? request : undefined,
  }).filter(([, value]) => value !== undefined));
}

export function runtimeFailurePayload(action, error, context = {}) {
  return {
    success: false,
    action,
    error: normalizeRuntimeError(error, context),
  };
}
