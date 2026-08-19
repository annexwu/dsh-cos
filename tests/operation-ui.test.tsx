import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getStorageCopy } from '../src/client/storage-copy.ts'
import { NewFolderModal } from '../src/client/NewFolderModal.tsx'
import { TaskDrawer } from '../src/client/TaskDrawer.tsx'

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
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
  document.documentElement.lang = ''
  delete reactGlobal.IS_REACT_ACT_ENVIRONMENT
})

describe('write operation UI', () => {
  it('submits a new folder name and closes after success', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    await act(async () => root.render(<NewFolderModal copy={getStorageCopy()} onCreate={onCreate} onClose={onClose} />))
    const input = container.querySelector<HTMLInputElement>('input')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, '资料')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => container.querySelector<HTMLFormElement>('form')?.requestSubmit())
    await settle()
    expect(onCreate).toHaveBeenCalledWith('资料')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders upload progress and exposes active task cancellation', async () => {
    const onPause = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn().mockResolvedValue(undefined)
    await act(async () => root.render(<TaskDrawer
      tasks={[{
        id: 'task-1',
        name: 'large.zip',
        path: 'backup/',
        key: 'root/backup/large.zip',
        size: 100,
        uploadedBytes: 35,
        status: 'uploading',
        speedBytesPerSecond: 20,
        createdAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:01.000Z',
      }]}
      copy={getStorageCopy()}
      canRetry={() => false}
      onPause={onPause}
      onResume={vi.fn()}
      onCancel={onCancel}
      onRetry={vi.fn()}
      onRemove={vi.fn()}
      onClearCompleted={vi.fn()}
      collapsed={false}
      onCollapsedChange={vi.fn()}
      onClose={vi.fn()}
    />))
    expect(container.textContent).toContain('large.zip')
    expect(container.textContent).toContain('35%')
    expect(container.textContent).not.toContain('目标目录: backup/')
    expect(container.textContent).toContain('20 B/s · 00:00')
    const pause = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '暂停')!
    await act(async () => pause.click())
    await settle()
    expect(onPause).toHaveBeenCalledWith('task-1')
    const cancel = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '取消')!
    await act(async () => cancel.click())
    await settle()
    expect(onCancel).toHaveBeenCalledWith('task-1')
    const collapse = container.querySelector<HTMLButtonElement>('[aria-label="收起传输队列"]')!
    await act(async () => collapse.click())
    expect(collapse.getAttribute('aria-expanded')).toBe('true')
  })

  it('shows task action failures inside the drawer', async () => {
    await act(async () => root.render(<TaskDrawer
      tasks={[{
        id: 'task-2',
        name: 'failed.txt',
        path: '',
        key: 'root/failed.txt',
        size: 10,
        uploadedBytes: 3,
        status: 'failed',
        speedBytesPerSecond: 0,
        error: 'network error',
        createdAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:01.000Z',
      }]}
      copy={getStorageCopy()}
      canRetry={() => true}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetry={vi.fn().mockRejectedValue(new Error('重试请求失败'))}
      onRemove={vi.fn()}
      onClearCompleted={vi.fn()}
      collapsed={false}
      onCollapsedChange={vi.fn()}
      onClose={vi.fn()}
    />))
    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '重试')!
    await act(async () => retry.click())
    await settle()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('重试请求失败')
  })
})
