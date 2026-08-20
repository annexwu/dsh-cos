import { describe, expect, it } from 'vitest'
import {
  ConfigValidationError,
  normalizeBucket,
  normalizeConfig,
  buildObjectKey,
  normalizeContentType,
  normalizeCustomDomain,
  normalizeStoragePath,
  normalizeListMarker,
  normalizeObjectKey,
  normalizeObjectName,
  normalizePrefix,
  normalizeRegion,
  normalizeUploadSize,
} from '../src/cos-config.ts'

describe('COS config normalization', () => {
  it('normalizes a valid configuration', () => {
    expect(normalizeConfig({
      bucket: ' Example-1250000000 ',
      region: ' AP-Guangzhou ',
      prefix: '/team\\reports',
      customDomain: 'https://static.example.com/',
    })).toEqual({
      bucket: 'example-1250000000',
      region: 'ap-guangzhou',
      prefix: 'team/reports/',
      customDomain: 'https://static.example.com',
    })
  })

  it('maps blank prefixes to the bucket root', () => {
    expect(normalizePrefix('  ')).toBe('')
    expect(normalizePrefix('/')).toBe('')
  })

  it('rejects invalid buckets, regions, and traversal prefixes', () => {
    expect(() => normalizeBucket('example')).toThrow(ConfigValidationError)
    expect(() => normalizeRegion('ap guangzhou')).toThrow(ConfigValidationError)
    expect(() => normalizePrefix('safe/../escape')).toThrow(ConfigValidationError)
  })

  it.each([
    'file:///tmp/file',
    'https://user:pass@example.com',
    'https://example.com/path',
    'https://127.0.0.1',
    'http://9.1.2.3',
    'http://10.0.0.1',
    'http://11.0.0.1',
    'http://21.0.0.1',
    'http://30.0.0.1',
    'http://127.0.0.1',
    'http://172.16.0.1',
    'http://192.168.1.2',
    'http://localhost',
  ])('rejects unsafe custom domain %s', (domain) => {
    expect(() => normalizeCustomDomain(domain)).toThrow(ConfigValidationError)
  })

  it('accepts canonical relative storage paths and markers under the active prefix', () => {
    expect(normalizeStoragePath(undefined)).toBe('')
    expect(normalizeStoragePath('team/reports/')).toBe('team/reports/')
    expect(normalizeListMarker('root/team/report.pdf', 'root/team/')).toBe('root/team/report.pdf')
  })

  it.each(['/absolute/', 'missing-slash', 'safe/../escape/', 'double//slash/', 'back\\slash/'])(
    'rejects invalid storage path %s',
    (path) => expect(() => normalizeStoragePath(path)).toThrow(ConfigValidationError),
  )

  it('rejects markers outside the configured directory prefix', () => {
    expect(() => normalizeListMarker('root/private/file', 'root/public/')).toThrow(ConfigValidationError)
  })

  it('validates write object names and builds keys under the configured root', () => {
    expect(normalizeObjectName('报告 2026.pdf', '文件名')).toBe('报告 2026.pdf')
    expect(buildObjectKey('root/', 'team/', '报告 2026.pdf')).toBe('root/team/报告 2026.pdf')
    expect(buildObjectKey('root/', 'team/', '资料', true)).toBe('root/team/资料/')
    expect(() => normalizeObjectName('../escape', '文件名')).toThrow(ConfigValidationError)
    expect(() => normalizeObjectName('a/b', '文件名')).toThrow(ConfigValidationError)
  })

  it('restricts download and delete keys to the configured storage root', () => {
    expect(normalizeObjectKey('root/team/a.txt', 'root/', 'file')).toBe('root/team/a.txt')
    expect(normalizeObjectKey('root/team/', 'root/', 'folder')).toBe('root/team/')
    expect(() => normalizeObjectKey('private/a.txt', 'root/', 'file')).toThrow(ConfigValidationError)
    expect(() => normalizeObjectKey('root/team/', 'root/', 'file')).toThrow(ConfigValidationError)
    expect(() => normalizeObjectKey('root/team', 'root/', 'folder')).toThrow(ConfigValidationError)
  })

  it('accepts large multipart uploads and sanitizes content type', () => {
    expect(normalizeUploadSize(0)).toBe(0)
    expect(normalizeUploadSize(6 * 1024 ** 3)).toBe(6 * 1024 ** 3)
    expect(normalizeUploadSize(50 * 1024 ** 4)).toBe(50 * 1024 ** 4)
    expect(() => normalizeUploadSize(-1)).toThrow(ConfigValidationError)
    expect(() => normalizeUploadSize(Number.POSITIVE_INFINITY)).toThrow(ConfigValidationError)
    expect(normalizeContentType('')).toBe('application/octet-stream')
    expect(() => normalizeContentType('text/plain\nX-Evil: 1')).toThrow(ConfigValidationError)
  })
})
