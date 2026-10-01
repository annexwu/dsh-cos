import React, { act } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindStoragePanel, CosStorageController } from '../src/client/controller.ts'
import { openDocumentPreviewConversation } from '../src/client/index.ts'
import { StoragePanel } from '../src/client/panel.tsx'
import { UploadCoordinator } from '../src/client/upload-coordinator.ts'

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  reactGlobal.IS_REACT_ACT_ENVIRONMENT = true
  document.documentElement.lang = 'zh-CN'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
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
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  document.documentElement.lang = ''
  delete reactGlobal.IS_REACT_ACT_ENVIRONMENT
  vi.unstubAllGlobals()
})

describe('COS storage panel', () => {
  it('renders the COS page in the main panel slot', async () => {
    const controller = new CosStorageController()
    await act(async () => { root.render(<StoragePanel controller={controller} onStartConversation={async () => {}} onRequestDocumentPreview={async () => {}} />) })
    expect(container.querySelector('[data-dsh-cos-storage-view]')?.textContent).toContain('COS 云存储')
  })

  it('keeps the shared upload queue alive when the COS panel unmounts', async () => {
    const controller = new CosStorageController()
    const coordinator = new UploadCoordinator(() => undefined)
    const dispose = vi.spyOn(coordinator, 'dispose')
    await act(async () => { root.render(<StoragePanel controller={controller} uploadCoordinator={coordinator} onStartConversation={async () => {}} onRequestDocumentPreview={async () => {}} />) })
    await act(async () => { root.render(<div>会话页</div>) })
    expect(dispose).not.toHaveBeenCalled()
    coordinator.dispose()
  })

  it('enables upload and new folder after the native sidebar selects the panel', async () => {
    const controller = new CosStorageController()
    let activePanelId: string | null = null
    const listeners = new Set<() => void>()
    const dispose = bindStoragePanel(controller, {
      getSnapshot: () => ({ activePanelId }),
      subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    }, 'dsh-cos')
    await act(async () => { root.render(<StoragePanel controller={controller} onStartConversation={async () => {}} onRequestDocumentPreview={async () => {}} />) })
    const upload = container.querySelector<HTMLButtonElement>('.dsh-cos-storage-toolbar .is-primary')!
    expect(upload.disabled).toBe(true)

    await act(async () => {
      activePanelId = 'dsh-cos'
      for (const listener of listeners) listener()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/objects/list'))).toBe(true)
    expect(container.querySelector('.dsh-cos-storage-page-subtitle')?.textContent).toContain('example-1250000000')
    expect(upload.disabled).toBe(false)
    expect(container.querySelector<HTMLButtonElement>('.dsh-cos-storage-toolbar__group button:not(.is-primary)')?.disabled).toBe(false)
    dispose()
  })

  it('navigates to the COS panel and back to the conversation', () => {
    const panels: Array<string | null> = []
    let selected: string | null = null
    const controller = new CosStorageController((open) => {
      if (open) { selected = 'dsh-cos'; panels.push(selected) }
      else if (selected === 'dsh-cos') { selected = null; panels.push(selected) }
    })
    controller.show()
    expect(panels).toEqual(['dsh-cos'])
    controller.close()
    expect(panels).toEqual(['dsh-cos', null])
  })

  it('opens the retained main session and inserts the AI preview request after existing references', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callback(0))
    const openSession = vi.fn()
    const bail = vi.fn().mockReturnValue(true)
    const focus = vi.fn()
    const draft = '已有草稿 /pdf 末尾'
    const input = { state: { getSnapshot: () => ({ draft, draftRev: 7, occurrences: [{ length: 4 }] }) }, focus }
    const actx = { get: () => ({ input: { for: () => input } }), bail }
    const ctx = {
      sessions: {
        list: { getSnapshot: () => ({ byId: {
          chosen: { id: 'chosen', retainedBy: { mainView: 1 } },
          newer: { id: 'newer', retainedBy: {} },
        } }) },
        scope: vi.fn().mockReturnValue(actx),
      },
      uiWorkspace: { openSession },
    } as unknown as Context

    await openDocumentPreviewConversation(ctx, 'test-bucket')

    expect(openSession).toHaveBeenCalledWith('chosen')
    expect(bail).toHaveBeenCalledWith(actx, 'slash/input-insert-text', {
      text: '\n请协助为 COS 存储桶 test-bucket 开通文档预览服务，并说明开通步骤。',
      span: { start: draft.length - 3, end: draft.length - 3, draftRev: 7 },
    })
    expect(focus).toHaveBeenCalledOnce()
  })

  it('reports when no main session is open instead of guessing the last session', async () => {
    const openSession = vi.fn()
    const ctx = {
      sessions: { list: { getSnapshot: () => ({ byId: { newer: { id: 'newer', retainedBy: {} } } }) } },
      uiWorkspace: { openSession },
    } as unknown as Context

    await expect(openDocumentPreviewConversation(ctx, 'test-bucket')).rejects.toThrow('当前没有打开的会话')
    expect(openSession).not.toHaveBeenCalled()
  })

  it('notifies the selected conversation when the input rejects the preview request', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callback(0))
    const notify = vi.fn()
    const input = { state: { getSnapshot: () => ({ draft: '', draftRev: 1, occurrences: [] }) }, notify }
    const actx = { get: () => ({ input: { for: () => input } }), bail: () => undefined }
    const ctx = {
      sessions: {
        list: { getSnapshot: () => ({ byId: { chosen: { id: 'chosen', retainedBy: { mainView: 1 } } } }) },
        scope: () => actx,
      },
      uiWorkspace: { openSession: vi.fn() },
    } as unknown as Context

    await expect(openDocumentPreviewConversation(ctx, 'test-bucket')).rejects.toThrow('无法将开通说明写入会话输入框')
    expect(notify).toHaveBeenCalledWith('error', '无法将开通说明写入会话输入框，请稍后重试。')
  })
})
