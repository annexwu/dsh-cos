import React, { useEffect, useRef, useState } from 'react'
import type { CosStorageItem, CosObjectPreviewResponse, CosTextPreviewEncoding } from '../protocol.ts'
import { CosStorageApiError, previewObject } from './api.ts'
import type { StorageCopy } from './storage-copy.ts'
import { formatBytes } from './storage-format.ts'
import { isCiDocumentPreviewExtension } from '../preview-policy.ts'

interface PreviewModalProps {
  item: CosStorageItem
  items: CosStorageItem[]
  copy: StorageCopy
  onDownload: (item: CosStorageItem) => void
  onRequestDocumentPreview?: (item: CosStorageItem) => Promise<void>
  onSelect: (item: CosStorageItem) => void
  onClose: () => void
}

function errorText(error: unknown, copy: StorageCopy, item: CosStorageItem): string {
  const message = error instanceof CosStorageApiError ? error.message : copy.previewFailed
  if (message.includes('文本预览限制')) return copy.previewTextTooLarge
  const extension = item.name.slice(item.name.lastIndexOf('.') + 1).toLowerCase()
  if (isCiDocumentPreviewExtension(extension)) return copy.previewCiUnavailable
  return message
}

const PREVIEW_FRAME_SANDBOX = 'allow-forms allow-popups allow-scripts'
const TEXT_PREVIEW_ENCODINGS: ReadonlyArray<{ value: CosTextPreviewEncoding; label: string }> = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'gb18030', label: 'GB18030（兼容 GBK / GB2312）' },
  { value: 'big5', label: 'Big5' },
  { value: 'shift_jis', label: 'Shift_JIS' },
  { value: 'euc-kr', label: 'EUC-KR' },
]

type PreviewIconKind = 'close' | 'previous' | 'next' | 'info'

function PreviewIcon({ kind }: { kind: PreviewIconKind }): React.JSX.Element {
  if (kind === 'close') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
  if (kind === 'previous') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 4.5-5 5.5 5 5.5" /></svg>
  if (kind === 'next') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 4.5 5 5.5-5 5.5" /></svg>
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 9v4m0-6v.1" /></svg>
}

export function previewFrameSandbox(url: string, parentOrigin = window.location.origin): string {
  try {
    const previewOrigin = new URL(url, `${parentOrigin}/`).origin
    return previewOrigin === parentOrigin ? PREVIEW_FRAME_SANDBOX : `${PREVIEW_FRAME_SANDBOX} allow-same-origin`
  } catch {
    return PREVIEW_FRAME_SANDBOX
  }
}

function ImagePreview({ url, copy }: { url: string; copy: StorageCopy }): React.JSX.Element {
  const [readyUrl, setReadyUrl] = useState<string>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    const image = new Image()
    setReadyUrl(undefined)
    setFailed(false)
    image.onload = () => {
      const decoded = image.decode?.()
      if (decoded) void decoded.catch(() => undefined).then(() => { if (active) setReadyUrl(url) })
      else if (active) setReadyUrl(url)
    }
    image.onerror = () => { if (active) setFailed(true) }
    image.src = url
    return () => {
      active = false
      image.onload = null
      image.onerror = null
    }
  }, [url])
  if (failed) return <div className="dsh-cos-preview__state is-error" role="alert">{copy.previewFailed}</div>
  if (readyUrl !== url) return <div className="dsh-cos-preview__state">{copy.previewLoading}</div>
  return <img className="dsh-cos-preview__image" src={readyUrl} alt="" />
}

function PreviewNotice({ title, message, action }: { title: string; message: string; action?: React.ReactNode }): React.JSX.Element {
  return <div className="dsh-cos-preview__notice">
    <PreviewIcon kind="info" />
    <h3>{title}</h3>
    <p>{message}</p>
    {action}
  </div>
}

function PreviewContent({ response, copy, item, onRequestDocumentPreview, textEncoding, onTextEncodingChange }: {
  response: CosObjectPreviewResponse
  copy: StorageCopy
  item: CosStorageItem
  onRequestDocumentPreview?: (item: CosStorageItem) => Promise<void>
  textEncoding: CosTextPreviewEncoding
  onTextEncodingChange: (encoding: CosTextPreviewEncoding) => void
}): React.JSX.Element {
  if (response.kind === 'text') return <div className="dsh-cos-preview__text-stage">
    <label className="dsh-cos-preview__encoding">
      <span>{copy.previewTextEncoding}</span>
      <select value={textEncoding} onChange={event => onTextEncodingChange(event.currentTarget.value as CosTextPreviewEncoding)}>
        {TEXT_PREVIEW_ENCODINGS.map(encoding => <option key={encoding.value} value={encoding.value}>{encoding.label}</option>)}
      </select>
    </label>
    <pre className="dsh-cos-preview__text">{response.text ?? ''}</pre>
  </div>
  if (response.kind === 'image' && response.url) return <ImagePreview url={response.url} copy={copy} />
  if (response.kind === 'video' && response.url) return <video className="dsh-cos-preview__video" controls src={response.url} />
  if (response.kind === 'audio' && response.url) return <audio className="dsh-cos-preview__audio" controls src={response.url} />
  if (response.kind === 'pdf' && response.url) return <iframe className="dsh-cos-preview__frame" title="PDF preview" src={response.url} />
  if (response.kind === 'ci-document' && response.url) return <iframe className="dsh-cos-preview__frame" title="Document preview" sandbox={previewFrameSandbox(response.url)} src={response.url} />
  if (response.kind === 'ci-unavailable') {
    return <PreviewNotice
      title={copy.previewCiUnavailableTitle}
      message={copy.previewCiUnavailable}
      action={onRequestDocumentPreview && <button type="button" onClick={() => void onRequestDocumentPreview(item)}>{copy.previewRequestEnable}</button>}
    />
  }
  return <PreviewNotice title={copy.previewUnsupportedTitle} message={response.message ?? copy.previewUnsupported} />
}

export function PreviewModal({ item, items, copy, onDownload, onRequestDocumentPreview, onSelect, onClose }: PreviewModalProps): React.JSX.Element {
  const [response, setResponse] = useState<CosObjectPreviewResponse>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [textEncoding, setTextEncoding] = useState<CosTextPreviewEncoding>('utf-8')
  const displayedItemKey = useRef<string>()
  const index = items.findIndex(candidate => candidate.key === item.key)
  const previous = index > 0 ? items[index - 1] : undefined
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : undefined

  useEffect(() => setTextEncoding('utf-8'), [item.key])

  useEffect(() => {
    let active = true
    const itemChanged = displayedItemKey.current !== item.key
    if (itemChanged) setResponse(undefined)
    setError(undefined)
    setLoading(true)
    void previewObject({ kind: 'file', key: item.key, encoding: textEncoding }).then(nextResponse => {
      if (!active) return
      displayedItemKey.current = item.key
      setResponse(nextResponse)
      setLoading(false)
    }).catch((previewError: unknown) => {
      if (!active) return
      setError(errorText(previewError, copy, item))
      setLoading(false)
    })
    return () => { active = false }
  }, [copy, item, textEncoding])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && previous) onSelect(previous)
      if (event.key === 'ArrowRight' && next) onSelect(next)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [next, onClose, onSelect, previous])

  return <div className="dsh-cos-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="dsh-cos-preview" role="dialog" aria-modal="true" aria-labelledby="dsh-cos-preview-title">
      <h2 id="dsh-cos-preview-title" className="dsh-cos-preview__title">{copy.previewTitle}</h2>
      <header className="dsh-cos-preview__toolbar">
        <button type="button" className="dsh-cos-preview__close" aria-label={copy.close} onClick={onClose}><PreviewIcon kind="close" /></button>
      </header>
      <div className="dsh-cos-preview__body">
        {!response && !error && loading && <div className="dsh-cos-preview__state">{copy.previewLoading}</div>}
        {error && <div className="dsh-cos-preview__state is-error" role="alert">{error}</div>}
        {response && <PreviewContent
          response={response}
          copy={copy}
          item={item}
          onRequestDocumentPreview={onRequestDocumentPreview}
          textEncoding={textEncoding}
          onTextEncodingChange={setTextEncoding}
        />}
        <button type="button" className="dsh-cos-preview__nav is-previous" aria-label={copy.previousFile} disabled={!previous} onClick={() => previous && onSelect(previous)}><PreviewIcon kind="previous" /></button>
        <button type="button" className="dsh-cos-preview__nav is-next" aria-label={copy.nextFile} disabled={!next} onClick={() => next && onSelect(next)}><PreviewIcon kind="next" /></button>
      </div>
      <footer className="dsh-cos-preview__footer"><span className="dsh-cos-preview__file-name" title={item.name}>{item.name}</span><span className="dsh-cos-preview__file-size">{formatBytes(item.size)}</span><button type="button" onClick={() => onDownload(item)}>{copy.download}</button></footer>
    </section>
  </div>
}
