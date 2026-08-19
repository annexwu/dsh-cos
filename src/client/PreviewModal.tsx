import React, { useEffect, useState } from 'react'
import type { CosStorageItem, CosObjectPreviewResponse } from '../protocol.ts'
import { CosStorageApiError, previewObject } from './api.ts'
import type { StorageCopy } from './storage-copy.ts'
import { formatBytes } from './storage-format.ts'

interface PreviewModalProps {
  item: CosStorageItem
  items: CosStorageItem[]
  copy: StorageCopy
  onDownload: (item: CosStorageItem) => void
  onSelect: (item: CosStorageItem) => void
  onClose: () => void
}

function errorText(error: unknown, copy: StorageCopy, item: CosStorageItem): string {
  const message = error instanceof CosStorageApiError ? error.message : copy.previewFailed
  if (message.includes('文本预览限制')) return copy.previewTextTooLarge
  const extension = item.name.slice(item.name.lastIndexOf('.') + 1).toLowerCase()
  if (new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'wps', 'et', 'dps']).has(extension)) return copy.previewCiUnavailable
  return message
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

function PreviewContent({ response, copy }: { response: CosObjectPreviewResponse; copy: StorageCopy }): React.JSX.Element {
  if (response.kind === 'text') return <pre className="dsh-cos-preview__text">{response.text ?? ''}</pre>
  if (response.kind === 'image' && response.url) return <ImagePreview url={response.url} copy={copy} />
  if (response.kind === 'video' && response.url) return <video className="dsh-cos-preview__video" controls src={response.url} />
  if (response.kind === 'audio' && response.url) return <audio className="dsh-cos-preview__audio" controls src={response.url} />
  if (response.kind === 'pdf' && response.url) return <iframe className="dsh-cos-preview__frame" title="PDF preview" src={response.url} />
  if (response.kind === 'ci-document' && response.url) return <iframe className="dsh-cos-preview__frame" title="Document preview" sandbox="allow-forms allow-popups allow-scripts" src={response.url} />
  if (response.kind === 'ci-unavailable') return <div className="dsh-cos-preview__ci-unavailable"><span aria-hidden="true">!</span><h3>{copy.previewCiUnavailableTitle}</h3><p>{copy.previewCiUnavailable}</p></div>
  return <div className="dsh-cos-preview__state">{response.message}</div>
}

export function PreviewModal({ item, items, copy, onDownload, onSelect, onClose }: PreviewModalProps): React.JSX.Element {
  const [response, setResponse] = useState<CosObjectPreviewResponse>()
  const [error, setError] = useState<string>()
  const index = items.findIndex(candidate => candidate.key === item.key)
  const previous = index > 0 ? items[index - 1] : undefined
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : undefined

  useEffect(() => {
    let active = true
    setResponse(undefined)
    setError(undefined)
    void previewObject({ kind: 'file', key: item.key }).then(nextResponse => { if (active) setResponse(nextResponse) }).catch((previewError: unknown) => { if (active) setError(errorText(previewError, copy, item)) })
    return () => { active = false }
  }, [copy, item])

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
      <div className="dsh-cos-preview__body">
        {!response && !error && <div className="dsh-cos-preview__state">{copy.previewLoading}</div>}
        {error && <div className="dsh-cos-preview__state is-error" role="alert">{error}</div>}
        {response && <PreviewContent response={response} copy={copy} />}
        <button type="button" className="dsh-cos-preview__nav is-previous" aria-label={copy.previousFile} disabled={!previous} onClick={() => previous && onSelect(previous)}>‹</button>
        <button type="button" className="dsh-cos-preview__nav is-next" aria-label={copy.nextFile} disabled={!next} onClick={() => next && onSelect(next)}>›</button>
      </div>
      <button type="button" className="dsh-cos-preview__close" aria-label={copy.close} onClick={onClose}>×</button>
      <footer className="dsh-cos-preview__footer"><span className="dsh-cos-preview__file-name" title={item.name}>{item.name}</span><span className="dsh-cos-preview__file-size">{formatBytes(item.size)}</span><button type="button" onClick={() => onDownload(item)}>{copy.download}</button></footer>
    </section>
  </div>
}
