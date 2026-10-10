import { Readable } from 'node:stream'
import COS from 'cos-nodejs-sdk-v5'
import { describe, expect, it, vi } from 'vitest'
import { assertCosFolderAttachmentBudget, createCosClient, decodeCosObjectText, mapCosStorageItems, multipartChunkSize, nextCosListMarker, PartStreamReader, probeCosDocumentPreview, uploadCosObject } from '../src/cos-client.ts'
import { DEFAULT_CONFIG } from '../src/config.ts'
import { assertUploadLength } from '../src/operation-routes.ts'
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

  it('continues truncated listings when COS omits NextMarker and rejects non-advancing pages', () => {
    const data = {
      IsTruncated: 'true',
      CommonPrefixes: [{ Prefix: 'root/010/' }, { Prefix: 'root/020/' }],
      Contents: [{ Key: 'root/015', Size: '1', LastModified: '', ETag: '', StorageClass: 'STANDARD' }],
    }
    expect(nextCosListMarker(data)).toBe('root/020/')
    expect(nextCosListMarker({ IsTruncated: 'true', Contents: [{ Key: 'root/100', Size: '1', LastModified: '', ETag: '', StorageClass: '' }] }, 'root/099')).toBe('root/100')
    expect(nextCosListMarker({ IsTruncated: 'true', NextMarker: 'explicit' })).toBe('explicit')
    expect(nextCosListMarker({ IsTruncated: 'false' })).toBeUndefined()
    expect(() => nextCosListMarker({ IsTruncated: 'true' })).toThrow('分页标记无效')
    expect(() => nextCosListMarker(data, 'root/020/')).toThrow('分页标记无效')
  })

  it('caps folder attachments before an unbounded directory download can exhaust the workspace', () => {
    expect(() => assertCosFolderAttachmentBudget(1_000, 1024 ** 3)).not.toThrow()
    expect(() => assertCosFolderAttachmentBudget(1_001, 1)).toThrow('超过 1000 个文件或 1 GiB')
    expect(() => assertCosFolderAttachmentBudget(1, 1024 ** 3 + 1)).toThrow('超过 1000 个文件或 1 GiB')
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

describe('streamed upload size validation', () => {
  it('accepts missing Content-Length from the desktop proxy, but rejects a declared mismatch', () => {
    expect(() => assertUploadLength({ headers: {} }, 4)).not.toThrow()
    expect(() => assertUploadLength({ headers: { 'content-length': '4' } }, 4)).not.toThrow()
    expect(() => assertUploadLength({ headers: { 'content-length': '0' } }, 4)).toThrow('上传内容大小与任务不一致')
    expect(() => assertUploadLength({ headers: { 'content-length': 'invalid' } }, 4)).toThrow('上传内容大小与任务不一致')
  })

  it('checks exact bytes across chunks and multipart boundaries without relying on HTTP headers', async () => {
    const reader = new PartStreamReader(Readable.from([Buffer.from('ab'), Buffer.from('cdef')]))
    const first: Buffer[] = []
    for await (const chunk of reader.read(3, async () => {}, () => {})) first.push(chunk)
    const second: Buffer[] = []
    for await (const chunk of reader.read(3, async () => {}, () => {})) second.push(chunk)
    expect(Buffer.concat(first).toString()).toBe('abc')
    expect(Buffer.concat(second).toString()).toBe('def')
    await expect(reader.assertComplete()).resolves.toBeUndefined()
  })

  it('commits only after the desktop-forwarded stream matches its registered task size', async () => {
    const init = vi.spyOn(COS.prototype, 'multipartInit').mockResolvedValue({ UploadId: 'test' } as COS.MultipartInitResult)
    const part = vi.spyOn(COS.prototype, 'multipartUpload').mockImplementation(async ({ Body }) => {
      const chunks: Buffer[] = []
      for await (const chunk of Body as Readable) chunks.push(Buffer.from(chunk as Uint8Array))
      return { ETag: Buffer.concat(chunks).toString() } as COS.MultipartUploadResult
    })
    const commit = vi.spyOn(COS.prototype, 'multipartComplete').mockResolvedValue({} as COS.MultipartCompleteResult)
    const abort = vi.spyOn(COS.prototype, 'multipartAbort').mockResolvedValue({} as COS.MultipartAbortResult)
    const put = vi.spyOn(COS.prototype, 'putObject').mockResolvedValue({} as COS.PutObjectResult)
    const options = { config: { ...DEFAULT_CONFIG, bucket: 'test-123', region: 'ap-guangzhou' },
      credentials: { secretId: 'test', secretKey: 'test' }, key: 'test.txt', contentType: 'text/plain',
      onControlReady: () => {}, onProgress: () => {} }
    try {
      await uploadCosObject({ ...options, body: Readable.from([Buffer.from('data')]), size: 4 })
      expect(init).toHaveBeenCalledOnce()
      expect(part).toHaveBeenCalledOnce()
      expect(commit).toHaveBeenCalledOnce()
      expect(abort).not.toHaveBeenCalled()

      commit.mockClear()
      await expect(uploadCosObject({ ...options, body: Readable.from([Buffer.from('data'), Buffer.from('extra')]), size: 4 }))
        .rejects.toThrow('上传内容大小与任务不一致')
      expect(commit).not.toHaveBeenCalled()
      expect(abort).toHaveBeenCalledOnce()

      abort.mockClear()
      await expect(uploadCosObject({ ...options, body: Readable.from([Buffer.from('dat')]), size: 4 }))
        .rejects.toThrow('上传内容大小与任务不一致')
      expect(commit).not.toHaveBeenCalled()
      expect(abort).toHaveBeenCalledOnce()

      await uploadCosObject({ ...options, body: Readable.from([]), size: 0 })
      expect(put).toHaveBeenCalledOnce()
      put.mockClear()
      await expect(uploadCosObject({ ...options, body: Readable.from([Buffer.from('extra')]), size: 0 }))
        .rejects.toThrow('上传内容大小与任务不一致')
      expect(put).not.toHaveBeenCalled()
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('rejects shorter or longer streams before committing an object', async () => {
    const short = new PartStreamReader(Readable.from([Buffer.from('ab')]))
    await expect((async () => {
      for await (const chunk of short.read(3, async () => {}, () => {})) void chunk
    })()).rejects.toThrow('上传内容大小与任务不一致')

    for (const chunks of [[Buffer.from('abcde')], [Buffer.from('abcd'), Buffer.from('e')]]) {
      const long = new PartStreamReader(Readable.from(chunks))
      for await (const chunk of long.read(4, async () => {}, () => {})) void chunk
      await expect(long.assertComplete()).rejects.toThrow('上传内容大小与任务不一致')
    }
    await expect(new PartStreamReader(Readable.from([Buffer.from('e')])).assertComplete())
      .rejects.toThrow('上传内容大小与任务不一致')
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
