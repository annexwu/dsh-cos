import React, { useEffect } from 'react'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ title, message, confirmLabel, cancelLabel, danger = false, onConfirm, onCancel }: ConfirmModalProps): React.JSX.Element {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
      if (event.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, onConfirm])

  return (
    <div className="dsh-cos-confirm-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel()
    }}>
      <section className="dsh-cos-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dsh-cos-confirm-title">
        <h2 id="dsh-cos-confirm-title">{title}</h2>
        <p>{message}</p>
        <footer>
          <button type="button" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={danger ? 'is-danger' : 'is-primary'} autoFocus onClick={onConfirm}>{confirmLabel}</button>
        </footer>
      </section>
    </div>
  )
}
