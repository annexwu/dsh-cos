import { describe, expect, it } from 'vitest'
import { mapCosStorageItems, multipartChunkSize } from '../src/cos-client.ts'

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
