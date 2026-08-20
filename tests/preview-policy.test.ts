import { describe, expect, it } from 'vitest'
import { isCiDocumentPreviewExtension } from '../src/preview-policy.ts'
import { previewFrameSandbox } from '../src/client/PreviewModal.tsx'

describe('document preview policy', () => {
  it('uses CI document preview for PDF and Office formats', () => {
    for (const extension of ['pdf', 'docx', 'pptx', 'xlsx', 'wps']) {
      expect(isCiDocumentPreviewExtension(extension)).toBe(true)
    }
    expect(isCiDocumentPreviewExtension('png')).toBe(false)
    expect(isCiDocumentPreviewExtension('mp4')).toBe(false)
  })

  it('allows same-origin capability only for cross-origin preview pages', () => {
    const parentOrigin = 'http://127.0.0.1:3080'
    expect(previewFrameSandbox('https://bucket.cos.ap-shanghai.myqcloud.com/file.pdf', parentOrigin)).toBe(
      'allow-forms allow-popups allow-scripts allow-same-origin',
    )
    expect(previewFrameSandbox('http://127.0.0.1:3080/preview', parentOrigin)).toBe(
      'allow-forms allow-popups allow-scripts',
    )
  })
})
