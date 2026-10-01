import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CosStorageItem } from '../src/protocol.ts'
import { PreviewModal } from '../src/client/PreviewModal.tsx'
import { getStorageCopy } from '../src/client/storage-copy.ts'

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }

const item: CosStorageItem = {
  kind: 'file',
  name: 'report.docx',
  path: 'reports/report.docx',
  key: 'reports/report.docx',
  size: 1024,
}

let container: HTMLDivElement
let root: Root

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  reactGlobal.IS_REACT_ACT_ENVIRONMENT = true
  document.documentElement.lang = 'zh-CN'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.lang = ''
  delete reactGlobal.IS_REACT_ACT_ENVIRONMENT
})

describe('PreviewModal', () => {
  it('uses a unified dark notice and offers an AI enablement action for unavailable documents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      kind: 'ci-unavailable',
      message: '文档预览服务尚未开通。',
    }), { headers: { 'Content-Type': 'application/json' } })))
    const onRequestDocumentPreview = vi.fn().mockResolvedValue(undefined)

    await act(async () => root.render(<PreviewModal
      item={item}
      items={[item]}
      copy={getStorageCopy()}
      onDownload={vi.fn()}
      onRequestDocumentPreview={onRequestDocumentPreview}
      onSelect={vi.fn()}
      onClose={vi.fn()}
    />))
    await settle()

    const notice = container.querySelector<HTMLElement>('.dsh-cos-preview__notice')
    expect(notice?.textContent).toContain('暂无法预览此文档')
    const requestEnable = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '让 AI 协助开通')
    expect(requestEnable).toBeDefined()
    await act(async () => requestEnable?.click())
    expect(onRequestDocumentPreview).toHaveBeenCalledWith(item)
    expect(container.querySelector('.dsh-cos-preview__toolbar .dsh-cos-preview__close svg')).not.toBeNull()
    expect(container.querySelector('.dsh-cos-preview__body .dsh-cos-preview__close')).toBeNull()
  })

  it('shows a navigation failure instead of silently ignoring the AI enablement click', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, kind: 'ci-unavailable' }), {
      headers: { 'Content-Type': 'application/json' },
    })))
    const onRequestDocumentPreview = vi.fn().mockRejectedValue(new Error('当前没有打开的会话，请先选择会话。'))
    await act(async () => root.render(<PreviewModal
      item={item}
      items={[item]}
      copy={getStorageCopy()}
      onDownload={vi.fn()}
      onRequestDocumentPreview={onRequestDocumentPreview}
      onSelect={vi.fn()}
      onClose={vi.fn()}
    />))
    await settle()

    const requestEnable = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent === '让 AI 协助开通')!
    await act(async () => requestEnable.click())

    expect(onRequestDocumentPreview).toHaveBeenCalledWith(item)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('当前没有打开的会话')
    expect(requestEnable.disabled).toBe(false)
  })

  it('reloads text content with the selected encoding', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, kind: 'text', text: '你好' }), {
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => root.render(<PreviewModal
      item={{ ...item, name: 'legacy.txt' }}
      items={[item]}
      copy={getStorageCopy()}
      onDownload={vi.fn()}
      onSelect={vi.fn()}
      onClose={vi.fn()}
    />))
    await settle()

    const textPreview = container.querySelector('pre')
    const select = container.querySelector<HTMLSelectElement>('.dsh-cos-preview__encoding select')!
    await act(async () => {
      select.value = 'gb18030'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await settle()
    expect(JSON.parse(fetchMock.mock.calls.at(-1)?.[1]?.body as string)).toMatchObject({ encoding: 'gb18030' })
    expect(container.querySelector('pre')).toBe(textPreview)
  })

  it('shows a titled notice instead of an empty dark preview area for unsupported files', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      kind: 'unsupported',
      message: '此文件类型暂不支持预览，可下载后在本地查看。',
    }), { headers: { 'Content-Type': 'application/json' } })))

    await act(async () => root.render(<PreviewModal
      item={{ ...item, name: 'archive.7z' }}
      items={[item]}
      copy={getStorageCopy()}
      onDownload={vi.fn()}
      onSelect={vi.fn()}
      onClose={vi.fn()}
    />))
    await settle()

    const notice = container.querySelector<HTMLElement>('.dsh-cos-preview__notice')
    expect(notice?.textContent).toContain('暂不支持预览')
    expect(notice?.textContent).toContain('可下载后在本地查看')
  })

  it('does not suggest enabling the service for a temporary COS preview failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, kind: 'ci-unavailable', reason: 'unavailable', message: '文档预览服务当前不可用。',
    }), { headers: { 'Content-Type': 'application/json' } })))
    await act(async () => root.render(<PreviewModal
      item={item} items={[item]} copy={getStorageCopy()} onDownload={vi.fn()}
      onRequestDocumentPreview={vi.fn()} onSelect={vi.fn()} onClose={vi.fn()}
    />))
    await settle()
    expect(container.querySelector('.dsh-cos-preview__notice')?.textContent).toContain('当前不可用')
    expect(container.textContent).not.toContain('让 AI 协助开通')
  })

  it('shows the actual COS error instead of claiming preview has not been enabled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false, error: { code: 'permission-denied', message: '没有文档预览权限' },
    }), { status: 403, headers: { 'Content-Type': 'application/json' } })))
    await act(async () => root.render(<PreviewModal
      item={item} items={[item]} copy={getStorageCopy()} onDownload={vi.fn()}
      onRequestDocumentPreview={vi.fn()} onSelect={vi.fn()} onClose={vi.fn()}
    />))
    await settle()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('没有文档预览权限')
    expect(container.textContent).not.toContain('尚未开通')
  })
})
