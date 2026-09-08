import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CosStorageController } from '../src/client/controller.ts'
import { mountStoragePanel, StorageOverlay } from '../src/client/panel.tsx'

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

describe('COS storage overlay', () => {
  it('renders only while storage is open', async () => {
    const controller = new CosStorageController()
    await act(async () => { root.render(<StorageOverlay controller={controller} />) })
    expect(container.querySelector('[data-dsh-cos-storage-view]')).toBeNull()

    await act(async () => { controller.show() })
    expect(container.querySelector('[data-dsh-cos-storage-view]')?.textContent).toContain('COS 云存储')

    await act(async () => { controller.close() })
    expect(container.querySelector('[data-dsh-cos-storage-view]')).toBeNull()
  })

  it('mounts the storage page in the conversation column without replacing the sidebar', async () => {
    const sidebar = document.createElement('aside')
    sidebar.textContent = '工作区'
    const conversation = document.createElement('main')
    conversation.dataset.pane = 'conversation'
    document.body.append(sidebar, conversation)

    const controller = new CosStorageController()
    let dispose = (): void => {}
    await act(async () => { dispose = mountStoragePanel(controller, async () => {}, async () => {}) })
    await act(async () => { controller.show() })

    expect(conversation.querySelector('[data-dsh-cos-storage-view]')?.textContent).toContain('COS 云存储')
    expect(sidebar.textContent).toBe('工作区')

    const session = document.createElement('button')
    session.className = 'sessionRow'
    sidebar.appendChild(session)
    await act(async () => { session.click() })
    expect(controller.getSnapshot().open).toBe(false)

    await act(async () => { dispose() })
    sidebar.remove()
    conversation.remove()
  })
})
