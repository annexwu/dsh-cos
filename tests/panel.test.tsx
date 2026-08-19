import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CosStorageController } from '../src/client/controller.ts'
import { mountPanel, VIEW_SELECTOR } from '../src/client/panel.tsx'

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }

describe('COS storage panel', () => {
  beforeEach(() => {
    reactGlobal.IS_REACT_ACT_ENVIRONMENT = true
    document.documentElement.lang = 'zh-CN'
    document.documentElement.removeAttribute('data-dsh-cos-storage-active')
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => new Response(JSON.stringify(
      url.endsWith('/uploads/list')
        ? { ok: true, tasks: [] }
        : {
            ok: true,
            bucket: 'example-1250000000',
            region: 'ap-guangzhou',
            rootPrefix: '',
            customDomain: '',
            path: '',
            items: [],
          },
    ), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    document.body.innerHTML = `
      <aside data-pane="sidebar"><button class="sessionRow">会话</button></aside>
      <main class="centerCol"><section class="conversationContent">对话</section></main>
    `
  })

  afterEach(() => {
    document.documentElement.lang = ''
    document.documentElement.removeAttribute('data-dsh-cos-storage-active')
    document.body.innerHTML = ''
    delete reactGlobal.IS_REACT_ACT_ENVIRONMENT
    vi.unstubAllGlobals()
  })

  it('mounts in the center column and returns to chat on a session click', async () => {
    const controller = new CosStorageController()
    let dispose: () => void = () => {}

    await act(async () => { dispose = mountPanel(controller) })
    expect(document.querySelector(VIEW_SELECTOR)?.parentElement).toBe(document.querySelector('.centerCol'))

    await act(async () => { controller.toggle() })
    expect(document.documentElement.hasAttribute('data-dsh-cos-storage-active')).toBe(true)
    expect(document.querySelector(VIEW_SELECTOR)?.textContent).toContain('COS 云存储')

    await act(async () => { document.querySelector<HTMLButtonElement>('.sessionRow')?.click() })
    expect(controller.getSnapshot().open).toBe(false)
    expect(document.documentElement.hasAttribute('data-dsh-cos-storage-active')).toBe(false)

    await act(async () => { dispose() })
    expect(document.querySelector(VIEW_SELECTOR)).toBeNull()
  })

  it('yields the center column when another plugin panel activates', async () => {
    const controller = new CosStorageController()
    let dispose: () => void = () => {}

    await act(async () => { dispose = mountPanel(controller) })
    await act(async () => { controller.toggle() })
    await act(async () => {
      document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'another-panel' }))
    })

    expect(controller.getSnapshot().open).toBe(false)
    await act(async () => { dispose() })
  })
})
