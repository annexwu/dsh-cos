import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StoragePanelIcon } from '../src/client/sidebar.tsx'

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
  await act(async () => { root.unmount() })
  container.remove()
  document.documentElement.lang = ''
  delete reactGlobal.IS_REACT_ACT_ENVIRONMENT
})

describe('COS storage sidebar panel icon', () => {
  it('renders the icon at the size provided by the DSH sidebar', async () => {
    await act(async () => { root.render(<StoragePanelIcon size={18} />) })
    const icon = container.querySelector('svg')
    expect(icon?.getAttribute('width')).toBe('18')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
  })
})
