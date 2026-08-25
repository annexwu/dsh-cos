import { describe, expect, it, vi } from 'vitest'
import { createCosClient, decodeCosObjectText, mapCosStorageItems, multipartChunkSize, probeCosDocumentPreview } from '../src/cos-client.ts'
import { buildDshCosUserAgent, DSH_COS_USER_AGENT } from '../src/user-agent.ts'

describe('COS object list mapping', () => {
  it('maps direct child folders and files relative to the configured storage root', () => {
    expect(mapCosStorageItems('root/', 'root/team/', {
      CommonPrefixes: [
        { Prefix: 'root/team/reports/' },
        { Prefix: 'outside/' },
      ],
      Contents: [
        {
          Key: 'root/team/',
          Size: '0',
          LastModified: '2026-08-18T01:00:00.000Z',
          ETag: '"folder-marker"',
          StorageClass: 'STANDARD',
        },
        {
          Key: 'root/team/readme.md',
          Size: '2048',
          LastModified: '2026-08-18T02:00:00.000Z',
          ETag: '"etag"',
          StorageClass: 'STANDARD_IA',
        },
      ],
    })).toEqual([
      {
        kind: 'folder',
        name: 'reports',
        key: 'root/team/reports/',
        path: 'team/reports/',
        size: 0,
      },
      {
        kind: 'file',
        name: 'readme.md',
        key: 'root/team/readme.md',
        path: 'team/readme.md',
        size: 2048,
        lastModified: '2026-08-18T02:00:00.000Z',
        eTag: '"etag"',
        storageClass: 'STANDARD_IA',
      },
    ])
  })

  it('chooses multipart chunks for files larger than 5GB without rejecting them', () => {
    const sixGiB = 6 * 1024 ** 3
    expect(multipartChunkSize(sixGiB)).toBe(8 * 1024 ** 2)
    const fortyTiB = 40 * 1024 ** 4
    const chunkSize = multipartChunkSize(fortyTiB)
    expect(Math.ceil(fortyTiB / chunkSize)).toBeLessThanOrEqual(10_000)
    expect(chunkSize).toBeLessThanOrEqual(5 * 1024 ** 3)
  })

  it('filters directory markers and non-direct descendants defensively', () => {
    const items = mapCosStorageItems('', '', {
      CommonPrefixes: [{ Prefix: 'folder/' }, { Prefix: 'deep/nested/' }],
      Contents: [{
        Key: 'deep/nested.txt',
        Size: '10',
        LastModified: 'invalid',
        ETag: 'etag',
        StorageClass: 'STANDARD',
      }],
    })
    expect(items.map(item => item.name)).toEqual(['folder'])
  })
})

describe('COS text decoding', () => {
  it('decodes common legacy Chinese text with GB18030', () => {
    expect(decodeCosObjectText(Buffer.from([0xc4, 0xe3, 0xba, 0xc3]), 'gb18030')).toBe('你好')
  })
})

describe('COS request identity', () => {
  it('builds a stable product UA without inventing a Skill version', () => {
    expect(buildDshCosUserAgent('1.2.3', '2.3.4', '3.4.5', 'win32', 'x64')).toBe(
      'dsh-cos/1.2.3 dsh/2.3.4 cos-nodejs-sdk-v5/3.4.5 os/windows-x64',
    )
    expect(buildDshCosUserAgent('1.2.3', '2.3.4', '3.4.5', 'darwin', 'arm64')).toContain('os/macos-arm64')
    expect(DSH_COS_USER_AGENT).toMatch(/^dsh-cos\/\S+ dsh\/\S+ cos-nodejs-sdk-v5\/\S+ os\/\S+$/)
    expect(DSH_COS_USER_AGENT).not.toContain('/unknown')
    expect(DSH_COS_USER_AGENT).not.toContain('skill/')
  })

  it('configures the COS SDK with the shared UA', () => {
    const client = createCosClient({ secretId: 'test-id', secretKey: 'test-key' })
    expect((client as unknown as { options: { UserAgent?: string } }).options.UserAgent).toBe(DSH_COS_USER_AGENT)
  })

  it('sends the shared UA when probing document preview availability', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('preview content'))
    try {
      await expect(probeCosDocumentPreview('https://example.com/preview')).resolves.toBe('available')
      const requestHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
      expect(requestHeaders.get('user-agent')).toBe(DSH_COS_USER_AGENT)
      expect(requestHeaders.get('range')).toBe('bytes=0-16383')
    } finally {
      fetchMock.mockRestore()
    }
  })
})
