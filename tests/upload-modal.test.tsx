import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getStorageCopy } from '../src/client/storage-copy.ts'
import { UploadModal } from '../src/client/UploadModal.tsx'

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
let container: HTMLDivElement
let root: Root

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

describe('UploadModal', () => {
  it('selects multiple files and submits upload candidates', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    await act(async () => root.render(<UploadModal copy={getStorageCopy()} onUpload={onUpload} onClose={onClose} />))

    expect(container.textContent).toContain('支持选择或拖拽多个文件、文件夹')
    const policy = container.querySelector<HTMLSelectElement>('.dsh-cos-upload-conflict-select select')!
    expect(policy.value).toBe('overwrite')
    await act(async () => {
      policy.value = 'rename'
      policy.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const input = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[0]
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['hello'], 'hello.txt'), new File(['world'], 'world.txt')],
    })
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))

    expect(container.textContent).toContain('hello.txt')
    expect(container.textContent).toContain('world.txt')
    expect(container.textContent).toContain('2 个文件')
    const upload = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '开始上传')!
    await act(async () => upload.click())
    expect(onClose).toHaveBeenCalledOnce()
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(onUpload).toHaveBeenCalledOnce()
    expect(onUpload.mock.calls[0][0]).toHaveLength(2)
    expect(onUpload.mock.calls[0][1]).toBe('rename')
  })
})
