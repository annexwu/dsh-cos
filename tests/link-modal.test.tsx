import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getStorageCopy } from '../src/client/storage-copy.ts'
import { LinkModal } from '../src/client/LinkModal.tsx'

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

describe('LinkModal', () => {
  it('defaults to one hour and exposes custom domain when configured', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    await act(async () => root.render(<LinkModal
      item={{ kind: 'file', name: 'report.pdf', key: 'root/report.pdf', path: 'report.pdf', size: 1 }}
      customDomain="https://files.example.com"
      copy={getStorageCopy()}
      onCreate={onCreate}
      onClose={onClose}
    />))

    expect(container.textContent).toContain('1 小时')
    expect(container.textContent).toContain('自定义域名')
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
    expect(radios).toHaveLength(2)
    expect(radios[1].checked).toBe(true)
    expect(radios[0].checked).toBe(false)
    const submit = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '复制链接')!
    await act(async () => submit.click())
    expect(onCreate).toHaveBeenCalledWith(3600, 'custom')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
