import { describe, expect, it, vi } from 'vitest'
import { cosRequest, parseCiRawError } from '../runtime/tencentcloud-cos/scripts/lib/ci_client.mjs'
import { normalizeRuntimeError, runtimeFailurePayload } from '../runtime/tencentcloud-cos/scripts/lib/runtime_error.mjs'
import { formatTencentCloudManagementFailure, sanitizeTencentCloudManagementOutput } from '../src/tencentcloud-tools.ts'

describe('Tencent Cloud runtime errors', () => {
  it('keeps the raw JSON error body and request identifiers from HTTP responses', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      Code: 'InvalidArgument',
      Message: 'Dataset binding is invalid.',
      RequestId: 'body-request-id',
    }), {
      status: 400,
      statusText: 'Bad Request',
      headers: {
        'content-type': 'application/json',
        'x-cos-request-id': 'header-request-id',
        'x-cos-trace-id': 'header-trace-id',
      },
    }))

    try {
      const raw = await cosRequest({
        method: 'POST',
        host: '1250000000.ci.ap-beijing.myqcloud.com',
        pathname: '/datasetbinding',
        creds: { secretId: 'test-id', secretKey: 'test-key' },
        body: '{}',
        extraHeaders: { Accept: 'application/json' },
      })

      expect(raw).toMatchObject({
        ok: false,
        status: 400,
        requestId: 'header-request-id',
        traceId: 'header-trace-id',
        host: '1250000000.ci.ap-beijing.myqcloud.com',
        pathname: '/datasetbinding',
      })
      expect(raw.body).toContain('Dataset binding is invalid.')
    } finally {
      fetchMock.mockRestore()
    }
  })

  it('parses root-level JSON and XML service errors', () => {
    expect(parseCiRawError({
      status: 400,
      requestId: 'header-request-id',
      traceId: 'header-trace-id',
      body: JSON.stringify({
        Code: 'InvalidArgument',
        Message: 'Dataset binding is invalid.',
        RequestId: 'body-request-id',
        Resource: '/datasetbinding',
        Details: { expected: 'cos://bucket-appid' },
      }),
    })).toEqual({
      code: 'InvalidArgument',
      message: 'Dataset binding is invalid.',
      requestId: 'body-request-id',
      traceId: 'header-trace-id',
      resource: '/datasetbinding',
      details: { expected: 'cos://bucket-appid' },
    })

    expect(parseCiRawError({
      status: 403,
      body: '<Error><Code>AccessDenied</Code><Message>Denied</Message><RequestId>xml-request</RequestId><TraceId>xml-trace</TraceId></Error>',
    })).toMatchObject({
      code: 'AccessDenied',
      message: 'Denied',
      requestId: 'xml-request',
      traceId: 'xml-trace',
    })
  })

  it('preserves nested SDK details and strips signed URL data', () => {
    const sdkError = Object.assign(new Error('Bad Request'), {
      code: '400',
      statusCode: 400,
      url: 'https://1250000000.ci.ap-beijing.myqcloud.com/datasetbinding?q-signature=must-not-leak',
      method: 'POST',
      headers: {
        'x-cos-request-id': 'Njabc123',
        'x-cos-trace-id': 'trace-456',
        authorization: 'must-not-leak',
      },
      error: {
        Code: 'InvalidArgument',
        Message: 'Bucket region does not match dataset region.',
        Resource: '/datasetbinding',
        Reason: 'RegionMismatch',
        Details: { expectedRegion: 'ap-beijing', authorization: 'must-not-leak' },
      },
    })

    expect(normalizeRuntimeError(sdkError)).toEqual({
      message: 'Bucket region does not match dataset region.',
      code: 'InvalidArgument',
      statusCode: 400,
      requestId: 'Njabc123',
      traceId: 'trace-456',
      resource: '/datasetbinding',
      details: {
        Reason: 'RegionMismatch',
        Details: { expectedRegion: 'ap-beijing' },
      },
      request: {
        method: 'POST',
        host: '1250000000.ci.ap-beijing.myqcloud.com',
        pathname: '/datasetbinding',
      },
    })
    expect(JSON.stringify(normalizeRuntimeError(sdkError))).not.toContain('q-signature')
    expect(JSON.stringify(normalizeRuntimeError(sdkError))).not.toContain('must-not-leak')
  })

  it('formats structured runtime failures for the Tool card', () => {
    const payload = runtimeFailurePayload('create-dataset-binding', {
      message: 'Bad Request',
      statusCode: 400,
      error: {
        Code: 'InvalidArgument',
        Message: 'The binding URI is invalid.',
        RequestId: 'request-123',
      },
      request: {
        method: 'POST',
        host: '1250000000.ci.ap-beijing.myqcloud.com',
        pathname: '/datasetbinding',
      },
    })
    const sanitized = sanitizeTencentCloudManagementOutput(payload)
    const message = formatTencentCloudManagementFailure('create-dataset-binding', sanitized)

    expect(message).toContain('create-dataset-binding failed [InvalidArgument]: The binding URI is invalid.')
    expect(message).toContain('HTTP status: 400')
    expect(message).toContain('RequestId: request-123')
    expect(message).toContain('Request: POST 1250000000.ci.ap-beijing.myqcloud.com/datasetbinding')
  })

  it('formats ci_api request metadata and keeps compatibility with flat errors', () => {
    expect(formatTencentCloudManagementFailure('list-datasets', {
      ok: false,
      error: { code: 'HTTP_503', message: 'Service unavailable' },
      request: {
        method: 'GET',
        host: '1250000000.ci.ap-shanghai.myqcloud.com',
        pathname: '/datasets',
        status: 503,
        requestId: 'request-503',
      },
    })).toContain('HTTP status: 503\nRequestId: request-503')

    expect(formatTencentCloudManagementFailure('list', {
      success: false,
      error: 'Access denied',
      code: 'AccessDenied',
    })).toBe('list failed [AccessDenied]: Access denied')
  })
})
