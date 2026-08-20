import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CosStoragePage } from '../src/client/CosStoragePage.tsx'
import { CosStorageController } from '../src/client/controller.ts'

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
let container: HTMLDivElement
let root: Root
let controller: CosStorageController

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  reactGlobal.IS_REACT_ACT_ENVIRONMENT = true
  document.documentElement.lang = 'zh-CN'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  controller = new CosStorageController()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.documentElement.lang = ''
  delete reactGlobal.IS_REACT_ACT_ENVIRONMENT
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('COS storage page', () => {
  it('renders a grid, previews files, and enters a folder', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/uploads/list')) return Promise.resolve(response({ ok: true, tasks: [] }))
      if (url.endsWith('/objects/preview')) return Promise.resolve(response({ ok: true, kind: 'text', text: '# Readme' }))
      const input = JSON.parse(init?.body as string) as { path?: string }
      if (input.path === 'reports/') {
        return Promise.resolve(response({
          ok: true,
          bucket: 'example-1250000000',
          region: 'ap-guangzhou',
          rootPrefix: 'root/',
          customDomain: '',
          path: 'reports/',
          items: [],
        }))
      }
      return Promise.resolve(response({
        ok: true,
        bucket: 'example-1250000000',
        region: 'ap-guangzhou',
        rootPrefix: 'root/',
        customDomain: '',
        path: '',
        items: [
          { kind: 'folder', name: 'reports', key: 'root/reports/', path: 'reports/', size: 0 },
          {
            kind: 'file',
            name: 'readme.md',
            key: 'root/readme.md',
            path: 'readme.md',
            size: 2048,
            lastModified: '2026-08-18T02:00:00.000Z',
            eTag: '"etag"',
            storageClass: 'STANDARD',
          },
        ],
      }))
    })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => root.render(<CosStoragePage controller={controller} />))
    await act(async () => controller.toggle())
    await settle()

    expect(container.querySelectorAll('.dsh-cos-storage-item')).toHaveLength(2)
    expect(container.textContent).toContain('第 1 页 · 本页 2 项')
    expect(container.querySelector('.dsh-cos-storage-page-subtitle')?.textContent).toContain('COS 云存储根目录: root/')
    const listView = container.querySelector<HTMLButtonElement>('[aria-label="列表视图"]')!
    await act(async () => listView.click())
    expect(container.querySelector('.dsh-cos-storage-grid')?.classList.contains('is-list')).toBe(true)
    const selectAll = container.querySelector<HTMLButtonElement>('.dsh-cos-storage-list-select-all')!
    await act(async () => selectAll.click())
    expect(container.textContent).toContain('已选择 2 项')
    expect(selectAll.getAttribute('aria-pressed')).toBe('true')
    await act(async () => selectAll.click())
    expect(container.textContent).not.toContain('已选择 2 项')
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })))
    expect(container.textContent).toContain('已选择 2 项')

    const file = container.querySelector<HTMLElement>('[title="readme.md"]')!
    await act(async () => file.click())
    expect(container.textContent).toContain('已选择 1 项')
    expect(container.textContent).not.toContain('已选择 2 项')
    expect(file.querySelector('.dsh-cos-storage-item__select')?.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector<HTMLElement>('[title="reports"]')?.querySelector('.dsh-cos-storage-item__select')?.getAttribute('aria-pressed')).toBe('false')
    const folder = container.querySelector<HTMLElement>('[title="reports"]')!
    await act(async () => folder.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })))
    expect(container.textContent).toContain('已选择 2 项')
    await act(async () => file.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })))
    expect(container.textContent).toContain('已选择 2 项')
    await act(async () => folder.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })))
    expect(container.textContent).toContain('已选择 1 项')
    const fileName = file.querySelector<HTMLButtonElement>('.dsh-cos-storage-item__name.is-interactive')!
    await act(async () => fileName.click())
    await settle()
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('# Readme')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('文件预览')

    await act(async () => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '关闭')?.click())
    const reportFolder = container.querySelector<HTMLElement>('[title="reports"]')!
    const folderName = reportFolder.querySelector<HTMLButtonElement>('.dsh-cos-storage-item__name.is-interactive')!
    await act(async () => folderName.click())
    await settle()

    const objectCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/objects/list'))
    const lastRequest = JSON.parse(objectCalls.at(-1)?.[1].body as string)
    expect(lastRequest).toEqual({ path: 'reports/' })
    expect(container.textContent).toContain('当前目录为空')
    expect(container.textContent).toContain('reports')
  })

  it('opens PDF documents in the preview modal instead of a new page', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/uploads/list')) return Promise.resolve(response({ ok: true, tasks: [] }))
      if (url.endsWith('/objects/preview')) {
        return Promise.resolve(response({
          ok: true,
          kind: 'ci-document',
          url: 'https://example-1250000000.cos.ap-shanghai.myqcloud.com/report.pdf?ci-process=doc-preview&dstType=html',
        }))
      }
      return Promise.resolve(response({
        ok: true,
        bucket: 'example-1250000000',
        region: 'ap-shanghai',
        rootPrefix: '',
        customDomain: '',
        path: '',
        items: [{
          kind: 'file',
          name: 'report.pdf',
          key: 'report.pdf',
          path: 'report.pdf',
          size: 1024,
        }],
      }))
    })
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(null)
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => root.render(<CosStoragePage controller={controller} />))
    await act(async () => controller.toggle())
    await settle()

    const file = container.querySelector<HTMLElement>('[title="report.pdf"]')!
    await act(async () => file.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    await settle()

    const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Document preview"]')
    expect(frame?.src).toContain('ci-process=doc-preview')
    expect(frame?.getAttribute('sandbox')).toContain('allow-same-origin')
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('opens inline settings for missing configuration and reloads after save', async () => {
    let configured = false
    let savedRequest: Record<string, unknown> | undefined
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/uploads/list')) return Promise.resolve(response({ ok: true, tasks: [] }))
      if (url.endsWith('/objects/list')) {
        return Promise.resolve(configured
          ? response({ ok: true, bucket: 'example-1250000000', region: 'ap-shanghai', rootPrefix: '', customDomain: '', path: '', items: [] })
          : response({ ok: false, error: { code: 'config-required', message: '请先配置 COS 存储桶和地域。' } }))
      }
      if (url.endsWith('/config') && init?.method === 'POST') {
        savedRequest = JSON.parse(init.body as string) as Record<string, unknown>
        configured = true
        return Promise.resolve(response({
          ok: true,
          config: {
            bucket: 'example-1250000000', region: 'ap-shanghai', prefix: '', customDomain: '',
            secretIdConfigured: true, secretKeyConfigured: true, credentialsWritable: true,
          },
        }))
      }
      if (url.endsWith('/config')) {
        return Promise.resolve(response({
          ok: true,
          config: {
            bucket: '', region: '', prefix: '', customDomain: '',
            secretIdConfigured: false, secretKeyConfigured: false, credentialsWritable: true,
          },
        }))
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => root.render(<CosStoragePage controller={controller} />))
    await act(async () => controller.toggle())
    await settle()

    const configure = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '去配置')!
    await act(async () => configure.click())
    await settle()
    const dialog = container.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="dsh-cos-settings-modal-title"]')!
    expect(dialog.textContent).toContain('配置 COS 云存储')

    const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement>('input'))
    const values = ['test-secret-id', 'test-secret-key', 'example-1250000000', 'ap-shanghai']
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      values.forEach((value, index) => {
        setter?.call(inputs[index], value)
        inputs[index].dispatchEvent(new Event('input', { bubbles: true }))
      })
    })
    const save = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '保存配置')!
    await act(async () => save.click())
    await settle()

    expect(savedRequest).toMatchObject({
      secretId: 'test-secret-id',
      secretKey: 'test-secret-key',
      bucket: 'example-1250000000',
      region: 'ap-shanghai',
    })
    expect(container.querySelector('[role="dialog"][aria-labelledby="dsh-cos-settings-modal-title"]')).toBeNull()
    expect(container.textContent).toContain('当前目录为空')
  })

  it('uses the returned marker when loading the next page', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/uploads/list')) return Promise.resolve(response({ ok: true, tasks: [] }))
      const input = JSON.parse(init?.body as string) as { marker?: string }
      return Promise.resolve(response({
        ok: true,
        bucket: 'example-1250000000',
        region: 'ap-guangzhou',
        rootPrefix: '',
        customDomain: '',
        path: '',
        items: [{
          kind: 'file',
          name: input.marker ? 'second.txt' : 'first.txt',
          key: input.marker ? 'second.txt' : 'first.txt',
          path: input.marker ? 'second.txt' : 'first.txt',
          size: 1,
        }],
        ...(input.marker ? {} : { nextMarker: 'first.txt' }),
      }))
    })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => root.render(<CosStoragePage controller={controller} />))
    await act(async () => controller.toggle())
    await settle()
    const next = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '下一页')!
    await act(async () => next.click())
    await settle()

    const objectCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/objects/list'))
    const lastRequest = JSON.parse(objectCalls.at(-1)?.[1].body as string)
    expect(lastRequest).toEqual({ path: '', marker: 'first.txt' })
    expect(container.textContent).toContain('second.txt')
    expect(container.textContent).toContain('第 2 页 · 本页 1 项')
  })
})
