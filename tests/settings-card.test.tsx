import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsCard } from '../src/client/SettingsCard.tsx'

const configured = {
  bucket: 'example-1250000000',
  region: 'ap-guangzhou',
  prefix: 'storage/',
  customDomain: '',
  secretIdConfigured: true,
  secretKeyConfigured: true,
  credentialsWritable: true,
}

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
let container: HTMLDivElement
let root: Root

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function renderCard(): Promise<void> {
  await act(async () => {
    root.render(<SettingsCard />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

function inputWithValue(value: string): HTMLInputElement | undefined {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input')).find(input => input.value === value)
}

function buttonWithText(text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes(text))
}

beforeEach(() => {
  reactGlobal.IS_REACT_ACT_ENVIRONMENT = true
  document.documentElement.lang = 'zh-CN'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  document.documentElement.lang = ''
  delete reactGlobal.IS_REACT_ACT_ENVIRONMENT
  vi.unstubAllGlobals()
})

describe('SettingsCard', () => {
  it('loads non-secret settings and never displays stored credential values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, config: configured }))
    vi.stubGlobal('fetch', fetchMock)

    await renderCard()

    expect(inputWithValue('example-1250000000')).toBeDefined()
    expect(inputWithValue('ap-guangzhou')).toBeDefined()
    expect(inputWithValue('storage/')).toBeDefined()
    expect(container.querySelectorAll('.dsh-cos-settings-card__field')).toHaveLength(6)
    expect(container.textContent).toContain('名称格式为 BucketName-APPID')
    expect(container.textContent).toContain('留空表示存储桶根目录')
    expect(container.textContent).toContain('COS 默认域名不支持文件在线预览')
    expect(container.textContent).toContain('连接配置已完成')
    expect(container.textContent).toContain('密钥已安全保存在 DSH Host 端')
    const createBucket = container.querySelector<HTMLAnchorElement>('a[href="https://cloud.tencent.com/product/cos"]')
    expect(createBucket?.textContent).toBe('创建存储桶')
    expect(createBucket?.target).toBe('_blank')
    expect(createBucket?.rel).toBe('noopener noreferrer')
    expect(container.textContent).not.toContain('stored-secret')
    expect(fetchMock).toHaveBeenCalledWith('/api/dsh-cos/config', expect.objectContaining({ credentials: 'same-origin' }))
  })

  it('reports an incomplete connection when the bucket is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      ok: true,
      config: { ...configured, bucket: '' },
    })))

    await renderCard()

    expect(container.textContent).toContain('请填写 SecretId、SecretKey、存储桶和地域')
    expect(container.querySelector('.dsh-cos-settings-card__credential-state')?.classList.contains('is-missing')).toBe(true)
  })

  it('submits changed settings while blank secret fields keep stored credentials', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, config: configured }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, config: { ...configured, prefix: 'next/' } }))
    vi.stubGlobal('fetch', fetchMock)

    await renderCard()
    const prefix = inputWithValue('storage/')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(prefix, 'next')
      prefix.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { buttonWithText('保存配置')?.click() })
    await settle()

    expect(container.textContent).toContain('配置已保存。')
    const request = fetchMock.mock.calls[1][1] as RequestInit
    expect(JSON.parse(request.body as string)).toEqual({
      bucket: 'example-1250000000',
      region: 'ap-guangzhou',
      prefix: 'next',
      customDomain: '',
    })
  })

  it('shows Host validation failures without losing form values', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, config: configured }))
      .mockResolvedValueOnce(jsonResponse({
        ok: false,
        error: { code: 'invalid-request', message: '地域格式不正确，例如 ap-guangzhou。' },
      }, 400))
    vi.stubGlobal('fetch', fetchMock)

    await renderCard()
    const region = inputWithValue('ap-guangzhou')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(region, 'bad region')
      region.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { buttonWithText('测试连接')?.click() })
    await settle()

    expect(container.textContent).toContain('地域格式不正确，例如 ap-guangzhou。')
    expect(inputWithValue('bad region')).toBeDefined()
  })

  it('collapses and restores the settings form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true, config: configured })))
    await renderCard()

    const summary = container.querySelector<HTMLButtonElement>('.dsh-cos-settings-card__summary-trigger')!
    await act(async () => { summary.click() })
    expect(inputWithValue('example-1250000000')).toBeUndefined()
    await act(async () => { summary.click() })
    expect(inputWithValue('example-1250000000')).toBeDefined()
  })
})
