import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CosStorageItem, CosUploadTask } from '../src/protocol.ts'
import { getStorageCopy } from '../src/client/storage-copy.ts'
import { ConversationAttachmentDock } from '../src/client/ConversationAttachments.tsx'
import { AttachmentPicker } from '../src/client/AttachmentPicker.tsx'
import { getAttachmentCopy } from '../src/client/attachment-copy.ts'
import { encodeSessionAttachmentReference } from '../src/client/attachment-reference.ts'
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
  vi.unstubAllGlobals()
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

  it('explains how to recover a queued browser task whose File was lost after refresh', async () => {
    const onCancel = vi.fn().mockResolvedValue(undefined)
    await act(async () => root.render(<TaskDrawer
      tasks={[{
        id: 'orphan', name: 'report.pdf', path: '', key: 'report.pdf', size: 10,
        uploadedBytes: 0, status: 'queued', speedBytesPerSecond: 0,
        createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
      }]}
      copy={getStorageCopy()} canRetry={() => false} hasBrowserFile={() => false}
      onPause={vi.fn()} onResume={vi.fn()} onCancel={onCancel} onRetry={vi.fn()}
      onRemove={vi.fn()} onClearCompleted={vi.fn()} collapsed={false}
      onCollapsedChange={vi.fn()} onClose={vi.fn()}
    />))
    expect(container.textContent).toContain('当前页面没有原文件')
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '取消')?.click())
    expect(onCancel).toHaveBeenCalledWith('orphan')
  })

  it('shows batch registration and renders only the first page of task rows', async () => {
    const tasks: CosUploadTask[] = Array.from({ length: 150 }, (_, index) => ({
      id: `task-${index}`,
      name: `${index}.txt`,
      path: '',
      key: `${index}.txt`,
      size: 100,
      uploadedBytes: index === 0 ? 100 : 0,
      status: index === 0 ? 'uploading' : 'queued',
      speedBytesPerSecond: 0,
      createdAt: '2026-08-18T00:00:00.000Z',
      updatedAt: '2026-08-18T00:00:01.000Z',
    }))
    await act(async () => root.render(<TaskDrawer
      tasks={tasks}
      registration={{ total: 200, processed: 150, accepted: 150, skipped: 0, failed: 0 }}
      copy={getStorageCopy()}
      canRetry={() => false}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetry={vi.fn()}
      onRemove={vi.fn()}
      onClearCompleted={vi.fn()}
      collapsed={false}
      onCollapsedChange={vi.fn()}
      onClose={vi.fn()}
    />))
    expect(container.querySelector('[role="status"]')?.textContent).toContain('150/200')
    expect(container.querySelectorAll('.dsh-cos-task-item')).toHaveLength(30)
    expect(container.querySelector('.dsh-cos-task-item')?.textContent).toContain('task-0'.replace('task-', '') + '.txt')
    expect(container.querySelector('.dsh-cos-task-item')?.textContent).toContain('99%')
    const showMore = container.querySelector<HTMLButtonElement>('.dsh-cos-task-show-more')!
    await act(async () => showMore.click())
    expect(container.querySelectorAll('.dsh-cos-task-item')).toHaveLength(60)
  })

  it('removes only one chip without rewriting the draft or discarding other references', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })))
    const foreign = '/other'
    const firstPath = 'D:/workspace/first.txt'
    const secondPath = 'D:/workspace/second.txt'
    const attachment = (path: string) => encodeSessionAttachmentReference({
      path, name: path.split('/').pop()!, size: 1, source: 'local', isDirectory: false,
    })
    const state = {
      draft: `${foreign} ${firstPath} ${secondPath}`,
      draftRev: 9,
      occurrences: [
        { source: 'other', ref: 'other', occurrenceId: 1, offset: 0, length: foreign.length, label: 'other' },
        { source: 'dsh-cos-attachment', ref: attachment(firstPath), occurrenceId: 2, offset: foreign.length + 1, length: firstPath.length, label: 'first' },
        { source: 'dsh-cos-attachment', ref: attachment(secondPath), occurrenceId: 3, offset: foreign.length + firstPath.length + 2, length: secondPath.length, label: 'second' },
      ],
    }
    const insertText = vi.fn().mockReturnValue(true)
    await act(async () => root.render(<ConversationAttachmentDock
      sessionId="session-1"
      useInput={selector => selector(state)}
      inputActions={{ insertText }}
    />))
    const cards = container.querySelectorAll<HTMLElement>('.dsh-cos-conversation-card')
    expect(cards).toHaveLength(2)
    await act(async () => cards[1].querySelector<HTMLButtonElement>('button')?.click())
    expect(insertText).toHaveBeenCalledWith('', { start: 4, end: 5, draftRev: 9 })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.stringContaining('/attachments/delete'), expect.anything())
  })

  it('keeps only failed files selected when a multi-file attachment pick partially succeeds', async () => {
    const items = ['first.pdf', 'second.pdf'].map(name => ({ kind: 'file' as const, name, key: name, path: name, size: 1 }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, path: '', items }), {
      headers: { 'Content-Type': 'application/json' },
    })))
    const onPick = vi.fn(async (selected: CosStorageItem[]) => {
      throw Object.assign(new Error('第二个文件导入失败'), { completedKeys: [selected[0].key] })
    })
    await act(async () => root.render(<AttachmentPicker sessionId="session-1" copy={getAttachmentCopy()} onPick={onPick} onClose={vi.fn()} />))
    await settle()
    const selections = document.body.querySelectorAll<HTMLButtonElement>('.dsh-cos-attachment-item__select')
    await act(async () => { selections[0].click(); selections[1].click() })
    const submit = document.body.querySelector<HTMLButtonElement>('.dsh-cos-attachment-picker footer .is-primary')!
    await act(async () => submit.click())
    expect(onPick.mock.calls[0]?.[0].map(item => item.key)).toEqual(['first.pdf', 'second.pdf'])
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('第二个文件导入失败')
    expect(selections[0].getAttribute('aria-pressed')).toBe('false')
    expect(selections[1].getAttribute('aria-pressed')).toBe('true')
    await act(async () => submit.click())
    expect(onPick.mock.calls[1]?.[0].map(item => item.key)).toEqual(['second.pdf'])
  })
})
