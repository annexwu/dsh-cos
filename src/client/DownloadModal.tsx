import React, { useEffect, useRef, useState } from 'react'
import type { CosStorageItem } from '../protocol.ts'
import type { StorageCopy } from './storage-copy.ts'

export type WritableDirectoryHandle = FileSystemDirectoryHandle & {
  requestPermission(descriptor?: { mode: 'readwrite' }): Promise<PermissionState>
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<WritableDirectoryHandle>
}

interface DownloadModalProps {
  item: CosStorageItem
  copy: StorageCopy
  onDownload: (directory: WritableDirectoryHandle | undefined) => Promise<void>
  onClose: () => void
}

function directoryPicker(): DirectoryPickerWindow['showDirectoryPicker'] {
  return (window as DirectoryPickerWindow).showDirectoryPicker
}

function canChooseDirectory(): boolean {
  return typeof directoryPicker() === 'function'
}

export function DownloadModal({ item, copy, onDownload, onClose }: DownloadModalProps): React.JSX.Element {
  const [directory, setDirectory] = useState<WritableDirectoryHandle>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const directoryPickerAvailable = canChooseDirectory()
  const chooseDirectoryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const chooseDirectory = async () => {
    try {
      setError(undefined)
      const picker = directoryPicker()
      if (picker === undefined) return
      const selected = await picker({ mode: 'readwrite' })
      setDirectory(selected)
    } catch (pickerError) {
      if (pickerError instanceof DOMException && pickerError.name === 'AbortError') return
      setError(copy.downloadDirectoryFailed)
    }
  }

  const submit = async () => {
    setBusy(true)
    setError(undefined)
    try {
      await onDownload(directory)
      onClose()
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : copy.downloadFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dsh-cos-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <section className="dsh-cos-download-dialog" role="dialog" aria-modal="true" aria-labelledby="dsh-cos-download-title">
        <header>
          <div>
            <h2 id="dsh-cos-download-title">{copy.downloadTitle}</h2>
            <p title={item.name}>{item.name}</p>
          </div>
          <button type="button" aria-label={copy.close} disabled={busy} onClick={onClose}>×</button>
        </header>
        <div className="dsh-cos-download-dialog__body">
          {directoryPickerAvailable ? (
            <>
              <span>{copy.downloadDirectory}</span>
              <div className="dsh-cos-download-directory">
                <strong>{directory?.name ?? copy.downloadDirectoryDefault}</strong>
                <button ref={chooseDirectoryRef} type="button" disabled={busy} onClick={() => void chooseDirectory()}>{copy.chooseDirectory}</button>
              </div>
              <small>{copy.downloadDirectoryHint}</small>
            </>
          ) : (
            <p className="dsh-cos-download-dialog__fallback">{copy.downloadBrowserFallback}</p>
          )}
          {error && <div className="dsh-cos-folder-dialog__error" role="alert">{error}</div>}
        </div>
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>{copy.cancel}</button>
          <button type="button" className="is-primary" disabled={busy} onClick={() => void submit()}>{busy ? copy.downloading : copy.download}</button>
        </footer>
      </section>
    </div>
  )
}
