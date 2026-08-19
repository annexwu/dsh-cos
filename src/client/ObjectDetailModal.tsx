import React, { useEffect } from 'react'
import type { CosStorageItem } from '../protocol.ts'
import type { StorageCopy } from './storage-copy.ts'
import { formatBytes, formatDate, formatStorageClass } from './storage-format.ts'
import { StorageIcon } from './StorageIcon.tsx'

interface ObjectDetailModalProps {
  item: CosStorageItem
  copy: StorageCopy
  onClose: () => void
}

export function ObjectDetailModal({ item, copy, onClose }: ObjectDetailModalProps): React.JSX.Element {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const rows = [
    [copy.type, item.kind === 'folder' ? copy.folder : copy.file],
    [copy.objectKey, item.key],
    ...(item.kind === 'file' ? [
      [copy.size, formatBytes(item.size)],
      [copy.modified, formatDate(item.lastModified)],
      [copy.storageClass, formatStorageClass(item.storageClass)],
      [copy.eTag, item.eTag || '—'],
    ] : []),
  ]

  return (
    <div className="dsh-cos-detail-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="dsh-cos-detail-modal" role="dialog" aria-modal="true" aria-labelledby="dsh-cos-detail-title">
        <header className="dsh-cos-detail-header">
          <div className="dsh-cos-detail-icon"><StorageIcon item={item} /></div>
          <div className="dsh-cos-detail-heading">
            <h2 id="dsh-cos-detail-title" title={item.name}>{item.name}</h2>
            <span>{copy.details}</span>
          </div>
          <button type="button" className="dsh-cos-detail-close" aria-label={copy.close} onClick={onClose}>×</button>
        </header>
        <dl className="dsh-cos-detail-list">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd title={value}>{value}</dd>
            </div>
          ))}
        </dl>
        <footer className="dsh-cos-detail-footer">
          <button type="button" onClick={onClose}>{copy.close}</button>
        </footer>
      </section>
    </div>
  )
}
