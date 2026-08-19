import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { HttpError, assertSafeRequest, isLoopbackRequest } from '../src/http.ts'

function request(options: {
  method?: string
  host?: string
  remoteAddress?: string
  origin?: string
  fetchSite?: string
  contentType?: string
} = {}): IncomingMessage {
  return {
    method: options.method ?? 'GET',
    headers: {
      host: options.host ?? '127.0.0.1:3080',
      ...(options.origin === undefined ? {} : { origin: options.origin }),
      ...(options.fetchSite === undefined ? {} : { 'sec-fetch-site': options.fetchSite }),
      ...(options.contentType === undefined ? {} : { 'content-type': options.contentType }),
    },
    socket: { remoteAddress: options.remoteAddress ?? '127.0.0.1' },
  } as unknown as IncomingMessage
}

describe('Host request boundary', () => {
  it('accepts loopback same-origin JSON requests', () => {
    const value = request({
      method: 'POST',
      origin: 'http://127.0.0.1:3080',
      fetchSite: 'same-origin',
      contentType: 'application/json',
    })
    expect(isLoopbackRequest(value)).toBe(true)
    expect(() => assertSafeRequest(value, 'POST')).not.toThrow()
  })

  it('rejects non-loopback clients even with a loopback Host header', () => {
    const value = request({ remoteAddress: '192.168.1.20' })
    expect(isLoopbackRequest(value)).toBe(false)
    expect(() => assertSafeRequest(value, 'GET')).toThrow(HttpError)
  })

  it('rejects cross-origin browser requests', () => {
    const value = request({
      method: 'POST',
      origin: 'https://attacker.example',
      fetchSite: 'cross-site',
      contentType: 'application/json',
    })
    expect(() => assertSafeRequest(value, 'POST')).toThrow('拒绝跨站请求')
  })

  it('rejects wrong methods and invalid write media types', () => {
    expect(() => assertSafeRequest(request({ method: 'DELETE' }), 'GET')).toThrow('请求方法不受支持')
    expect(() => assertSafeRequest(request({ method: 'POST', contentType: 'text/plain' }), 'POST')).toThrow('application/json')
    expect(() => assertSafeRequest(
      request({ method: 'POST', contentType: 'application/octet-stream' }),
      'POST',
      'binary',
    )).not.toThrow()
    expect(() => assertSafeRequest(
      request({ method: 'POST', contentType: 'application/json' }),
      'POST',
      'binary',
    )).toThrow('application/octet-stream')
  })
})
